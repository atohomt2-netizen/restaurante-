/* programa.js - Lógica del restaurante + almacenamiento en IndexedDB */

// ---------- 1. LISTA DE PRECIOS (en quetzales) ----------
const PRECIOS = {
    pizza: 60.00, hamburguesa: 38.00, pepian: 45.00, hilachas: 42.00, tacos: 35.00,
    pequena: 6.00, mediana: 9.00, grande: 12.00,
    papas: 15.00, helado: 11.00
};
const NOMBRES = {
    pizza: "Pizza Familiar", hamburguesa: "Hamburguesa con Queso", pepian: "Pepián con Arroz",
    hilachas: "Hilachas con Tortillas", tacos: "Orden de Tacos"
};
const IVA = 0.12;      // IVA de Guatemala (incluido en el precio)
const PROPINA = 0.10;  // propina sugerida

const q = valor => "Q" + valor.toFixed(2);

// ---------- 2. INDEXEDDB ----------
const NOMBRE_BD = "restauranteDB";
const ALMACEN = "pedidos";
let db = null;

function abrirBD() {
    return new Promise((resolve, reject) => {
        const solicitud = indexedDB.open(NOMBRE_BD, 1);
        solicitud.onupgradeneeded = e => {
            const bd = e.target.result;
            if (!bd.objectStoreNames.contains(ALMACEN)) {
                bd.createObjectStore(ALMACEN, { keyPath: "id", autoIncrement: true });
            }
        };
        solicitud.onsuccess = e => { db = e.target.result; resolve(db); };
        solicitud.onerror = () => reject(solicitud.error);
    });
}

function guardarPedido(pedido) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ALMACEN, "readwrite");
        const req = tx.objectStore(ALMACEN).add(pedido);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function leerPedidos() {
    return new Promise((resolve, reject) => {
        const req = db.transaction(ALMACEN, "readonly").objectStore(ALMACEN).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function borrarPedidos() {
    return new Promise((resolve, reject) => {
        const req = db.transaction(ALMACEN, "readwrite").objectStore(ALMACEN).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ---------- 3. FORMULARIO: calcular cuenta y guardar ----------
document.getElementById("formularioRestaurante").addEventListener("submit", async function (event) {
    event.preventDefault();

    const cliente = document.getElementById("nombreCliente").value.trim();
    const plato = document.getElementById("platoPrincipal").value;
    const cantidad = parseInt(document.getElementById("cantidad").value, 10);
    const bebida = document.querySelector('input[name="tamanoBebida"]:checked').value;
    const quierePapas = document.getElementById("extraPapas").checked;
    const quiereHelado = document.getElementById("extraHelado").checked;
    const quierePropina = document.getElementById("propina").checked;

    let detalle = "<strong>🧾 DETALLE DE TU PEDIDO:</strong><br><hr>";
    let subtotal = 0;
    const extras = [];

    const totalPlatos = PRECIOS[plato] * cantidad;
    subtotal += totalPlatos;
    detalle += `• ${NOMBRES[plato]} x${cantidad}: ${q(totalPlatos)}<br>`;

    subtotal += PRECIOS[bebida];
    detalle += `• Bebida (${bebida}): ${q(PRECIOS[bebida])}<br>`;

    if (quierePapas) {
        subtotal += PRECIOS.papas; extras.push("Papas Fritas");
        detalle += `• Extra Papas Fritas: ${q(PRECIOS.papas)}<br>`;
    }
    if (quiereHelado) {
        subtotal += PRECIOS.helado; extras.push("Helado");
        detalle += `• Extra Helado: ${q(PRECIOS.helado)}<br>`;
    }

    const ivaIncluido = subtotal - subtotal / (1 + IVA);
    const propina = quierePropina ? subtotal * PROPINA : 0;
    const total = subtotal + propina;

    detalle += `<hr>Subtotal: ${q(subtotal)}<br>`;
    detalle += `<small>IVA (12%) incluido: ${q(ivaIncluido)}</small><br>`;
    if (quierePropina) detalle += `Propina (10%): ${q(propina)}<br>`;
    detalle += `<hr><strong>💰 TOTAL A PAGAR: ${q(total)}</strong>`;

    const pedido = {
        cliente, plato: NOMBRES[plato], cantidad, bebida,
        extras: extras.length ? extras.join(", ") : "Ninguno",
        propina: quierePropina ? "Sí" : "No",
        total: Number(total.toFixed(2)),
        fecha: new Date().toLocaleString("es-GT")
    };

    try {
        const id = await guardarPedido(pedido);
        detalle += `<br><small>✅ Pedido #${id} guardado en IndexedDB para ${cliente}.</small>`;
    } catch (error) {
        detalle += "<br><small>⚠️ No se pudo guardar el pedido.</small>";
        console.error(error);
    }

    const area = document.getElementById("reciboRespuesta");
    area.innerHTML = detalle;
    area.style.display = "block";
});

// ---------- 4. BOTÓN MOSTRAR DATOS ----------
document.getElementById("btnMostrar").addEventListener("click", async function () {
    const contenedor = document.getElementById("listaPedidos");
    const pedidos = await leerPedidos();

    if (pedidos.length === 0) {
        contenedor.innerHTML = '<div class="mensaje">No hay pedidos guardados.</div>';
        return;
    }

    let html = "<table><thead><tr><th>#</th><th>Cliente</th><th>Plato</th><th>Cant.</th><th>Extras</th><th>Total</th><th>Fecha</th></tr></thead><tbody>";
    pedidos.forEach(p => {
        html += `<tr><td>${p.id}</td><td>${escapar(p.cliente)}</td><td>${p.plato}</td><td>${p.cantidad}</td><td>${p.extras}</td><td>${q(p.total)}</td><td>${p.fecha}</td></tr>`;
    });
    html += "</tbody></table>";
    contenedor.innerHTML = html;
});

// ---------- 5. BOTÓN LIMPIAR DATOS ----------
document.getElementById("btnLimpiar").addEventListener("click", async function () {
    if (!confirm("¿Seguro que deseas borrar todos los pedidos guardados?")) return;
    await borrarPedidos();
    document.getElementById("listaPedidos").innerHTML = '<div class="mensaje">🗑️ Datos eliminados correctamente.</div>';
    document.getElementById("reciboRespuesta").style.display = "none";
});

// Evita que texto escrito por el usuario se interprete como HTML
function escapar(texto) {
    const d = document.createElement("div");
    d.textContent = texto;
    return d.innerHTML;
}

// ---------- 6. INICIO ----------
abrirBD().catch(err => console.error("Error al abrir IndexedDB:", err));

