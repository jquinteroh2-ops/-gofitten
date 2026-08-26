/* ============================================================
   GoFitten - Panel de dueños
   ------------------------------------------------------------
   Pedidos (historial), productos (editar / deshabilitar) y cuenta.
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const CAT_NAMES = {
  mujer: "Mujer", hombre: "Hombre", ninos: "Niños",
  accesorios: "Accesorios", deportes: "Deportes", ofertas: "Ofertas",
};
const STATUS_LABELS = {
  nuevo: "Nuevo", confirmado: "Confirmado",
  entregado: "Entregado", cancelado: "Cancelado",
};

/* ---------- Estado ---------- */
const BASE_PRODUCTS = window.PRODUCTS || [];
let overrides = {};          // { idProducto: { campos editados } }
let orders = [];
let orderFilter = "todos";
let orderSearch = "";
let prodSearch = "";
let prodCat = "";
let prodEstado = "";
let prodVisible = 30;
let editingId = null;

/* ---------- Utilidades ---------- */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(n) {
  return "$" + Number(n || 0).toLocaleString("es-CO");
}
function fecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function esHoy(iso) {
  const d = new Date(iso);
  const h = new Date();
  return d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
}

let toastTimer = null;
function toast(msg, isError) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.toggle("error", !!isError);
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// Llamadas a la API: si la sesión caducó, vuelve al login
async function api(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error inesperado.");
  return data;
}

/* ---------- Producto con sus ediciones aplicadas ---------- */
function merged(p) {
  const ov = overrides[p.id];
  return ov ? { ...p, ...ov, _editado: true } : { ...p, _editado: false };
}

/* ============================================================
   PEDIDOS
   ============================================================ */
async function cargarPedidos() {
  try {
    const data = await api("/api/admin/pedidos");
    orders = data.orders || [];
    renderStats();
    renderPedidos();
  } catch (e) {
    toast(e.message, true);
  }
}

function renderStats() {
  const activos = orders.filter((o) => o.status !== "cancelado");
  const nuevos = orders.filter((o) => o.status === "nuevo").length;
  const hoy = orders.filter((o) => esHoy(o.createdAt)).length;
  const vendido = activos.reduce((s, o) => s + (o.total || 0), 0);

  $("#statsRow").innerHTML = `
    <div class="stat"><div class="stat-label">Pedidos totales</div><div class="stat-value">${orders.length}</div></div>
    <div class="stat blue"><div class="stat-label">Sin atender</div><div class="stat-value">${nuevos}</div></div>
    <div class="stat"><div class="stat-label">Hoy</div><div class="stat-value">${hoy}</div></div>
    <div class="stat green"><div class="stat-label">Valor de pedidos</div><div class="stat-value">${money(vendido)}</div></div>`;

  const badge = $("#tabBadgePedidos");
  badge.textContent = nuevos;
  badge.hidden = nuevos === 0;
}

function pedidosFiltrados() {
  const q = orderSearch.trim().toLowerCase();
  return orders.filter((o) => {
    if (orderFilter !== "todos" && o.status !== orderFilter) return false;
    if (!q) return true;
    const texto = [
      o.numero, o.cliente.nombre, o.cliente.barrio, o.cliente.ciudad,
      o.cliente.telefono, o.cliente.direccion,
      ...o.items.map((it) => it.title),
    ].join(" ").toLowerCase();
    return texto.includes(q);
  });
}

function pedidoHtml(o) {
  const items = o.items.map((it) => `
    <div class="order-item">
      <img src="${escapeHtml(it.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="order-item-info">
        <div class="order-item-title">${escapeHtml(it.title)}</div>
        <div class="order-item-meta">${it.cantidad} und${it.talla ? " · " + escapeHtml(it.talla) : ""} · ${money(it.priceNum)} c/u</div>
      </div>
      <div class="order-item-sub">${money(it.subtotal)}</div>
    </div>`).join("");

  const c = o.cliente;
  const zona = c.ciudad === "Cartagena" && c.barrio ? `Cartagena — ${escapeHtml(c.barrio)}` : escapeHtml(c.ciudad || "—");
  const tel = c.telefono
    ? `<p><strong>WhatsApp:</strong> <a href="https://wa.me/57${escapeHtml(c.telefono.replace(/\D/g, "").slice(-10))}" target="_blank" rel="noopener">${escapeHtml(c.telefono)}</a></p>`
    : "";
  const unidades = o.items.reduce((s, it) => s + it.cantidad, 0);

  return `
  <article class="order-card ${o.status}" data-id="${o.id}">
    <div class="order-top" data-toggle>
      <span class="order-num">#${o.numero}</span>
      <div class="order-main">
        <div class="order-client">${escapeHtml(c.nombre)}</div>
        <div class="order-meta">${fecha(o.createdAt)} · ${o.items.length} producto(s) · ${unidades} und</div>
      </div>
      <span class="status-tag status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
      <span class="order-total">${money(o.total)}</span>
      <span class="order-caret">▼</span>
    </div>
    <div class="order-body">
      <div class="order-cols">
        <div class="order-items">${items}</div>
        <div class="order-data">
          <p><strong>Cliente:</strong> ${escapeHtml(c.nombre)}</p>
          ${tel}
          <p><strong>Zona:</strong> ${zona}</p>
          <p><strong>Dirección:</strong> ${escapeHtml(c.direccion || "—")}</p>
          ${c.comentario ? `<p><strong>Comentario:</strong> ${escapeHtml(c.comentario)}</p>` : ""}
          <div class="order-sums">
            <div><span>Productos</span><span>${money(o.subtotal)}</span></div>
            <div><span>Envío</span><span>${o.envio ? money(o.envio) : "GRATIS"}</span></div>
            <div class="total"><span>Total</span><span>${money(o.total)}</span></div>
          </div>
        </div>
      </div>
      <div class="order-actions">
        <label class="order-note">Nota interna
          <input type="text" value="${escapeHtml(o.nota || "")}" data-nota placeholder="Ej: pagó por Nequi, entregar el sábado...">
        </label>
        ${o.status !== "confirmado" ? '<button type="button" class="btn btn-sm btn-ghost" data-status="confirmado">Marcar confirmado</button>' : ""}
        ${o.status !== "entregado" ? '<button type="button" class="btn btn-sm btn-dark" data-status="entregado">Marcar entregado</button>' : ""}
        ${o.status !== "nuevo" ? '<button type="button" class="btn btn-sm btn-ghost" data-status="nuevo">Volver a nuevo</button>' : ""}
        ${o.status !== "cancelado" ? '<button type="button" class="btn btn-sm btn-danger" data-status="cancelado">Cancelar</button>' : ""}
        <button type="button" class="btn btn-sm btn-danger" data-del>Eliminar</button>
      </div>
    </div>
  </article>`;
}

function renderPedidos() {
  const lista = pedidosFiltrados();
  const wrap = $("#ordersList");
  const empty = $("#ordersEmpty");

  if (lista.length === 0) {
    wrap.innerHTML = "";
    empty.hidden = false;
    empty.textContent = orders.length === 0
      ? "Todavía no hay pedidos registrados. Aparecerán aquí en cuanto un cliente envíe su pedido por WhatsApp."
      : "Ningún pedido coincide con este filtro.";
    return;
  }
  empty.hidden = true;
  wrap.innerHTML = lista.map(pedidoHtml).join("");
}

async function cambiarPedido(id, cambios) {
  try {
    await api(`/api/admin/pedidos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) });
    const o = orders.find((x) => x.id === id);
    if (o) Object.assign(o, cambios);
    renderStats();
    renderPedidos();
    toast("Pedido actualizado");
  } catch (e) {
    toast(e.message, true);
  }
}

async function borrarPedido(id) {
  const o = orders.find((x) => x.id === id);
  if (!confirm(`¿Eliminar el pedido #${o ? o.numero : ""}? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/admin/pedidos/${id}`, { method: "DELETE" });
    orders = orders.filter((x) => x.id !== id);
    renderStats();
    renderPedidos();
    toast("Pedido eliminado");
  } catch (e) {
    toast(e.message, true);
  }
}

function exportarCSV() {
  const lista = pedidosFiltrados();
  if (!lista.length) return toast("No hay pedidos para exportar", true);
  const filas = [["N.º", "Fecha", "Estado", "Cliente", "Telefono", "Ciudad", "Barrio", "Direccion", "Productos", "Subtotal", "Envio", "Total", "Nota"]];
  lista.forEach((o) => {
    const productos = o.items.map((it) => `${it.cantidad}x ${it.title}${it.talla ? " (" + it.talla + ")" : ""}`).join(" | ");
    filas.push([
      o.numero, fecha(o.createdAt), STATUS_LABELS[o.status] || o.status,
      o.cliente.nombre, o.cliente.telefono, o.cliente.ciudad, o.cliente.barrio,
      o.cliente.direccion, productos, o.subtotal, o.envio, o.total, o.nota || "",
    ]);
  });
  const csv = filas
    .map((f) => f.map((v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pedidos-gofitten-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ============================================================
   PRODUCTOS
   ============================================================ */
async function cargarAjustes() {
  try {
    const data = await api("/api/admin/ajustes");
    overrides = data.items || {};
  } catch (e) {
    toast(e.message, true);
  }
  renderProdStats();
  renderProductos();
}

function renderProdStats() {
  let ocultos = 0, agotados = 0, ofertas = 0;
  BASE_PRODUCTS.forEach((p) => {
    const m = merged(p);
    if (m.hidden) ocultos++;
    if (!m.available) agotados++;
    if (m.onSale) ofertas++;
  });
  $("#prodStatsRow").innerHTML = `
    <div class="stat"><div class="stat-label">Productos</div><div class="stat-value">${BASE_PRODUCTS.length}</div></div>
    <div class="stat green"><div class="stat-label">Visibles</div><div class="stat-value">${BASE_PRODUCTS.length - ocultos}</div></div>
    <div class="stat red"><div class="stat-label">Ocultos</div><div class="stat-value">${ocultos}</div></div>
    <div class="stat"><div class="stat-label">Agotados</div><div class="stat-value">${agotados}</div></div>
    <div class="stat blue"><div class="stat-label">En oferta</div><div class="stat-value">${ofertas}</div></div>`;
}

function productosFiltrados() {
  const q = prodSearch.trim().toLowerCase();
  return BASE_PRODUCTS.map(merged).filter((p) => {
    if (prodCat && p.category !== prodCat) return false;
    if (q && !p.title.toLowerCase().includes(q) && !p.id.includes(q)) return false;
    if (prodEstado === "visible" && p.hidden) return false;
    if (prodEstado === "oculto" && !p.hidden) return false;
    if (prodEstado === "agotado" && p.available) return false;
    if (prodEstado === "oferta" && !p.onSale) return false;
    if (prodEstado === "editado" && !p._editado) return false;
    return true;
  });
}

function prodHtml(p) {
  const tags = [
    p.hidden ? '<span class="tag tag-hidden">Oculto</span>' : "",
    p.available ? '<span class="tag tag-ok">Disponible</span>' : '<span class="tag tag-out">Agotado</span>',
    p.onSale ? '<span class="tag tag-sale">Oferta</span>' : "",
    p._editado ? '<span class="tag tag-edit">Editado</span>' : "",
  ].join("");

  return `
  <div class="prod-row ${p.hidden ? "oculto" : ""}" data-id="${escapeHtml(p.id)}">
    <img src="${escapeHtml(p.images[0] || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <div class="prod-info">
      <div class="prod-title">${escapeHtml(p.title)}</div>
      <div class="prod-sub">${CAT_NAMES[p.category] || p.category} ${p.subcategory ? "· " + escapeHtml(p.subcategory) : ""}</div>
      <div class="prod-tags">${tags}</div>
    </div>
    <div class="prod-price">
      ${p.compareAtPrice ? `<span class="before">${money(p.compareAtPrice)}</span>` : ""}
      ${money(p.priceNum)}
    </div>
    <div class="prod-actions">
      <button type="button" class="btn btn-sm btn-yellow" data-act="edit">Editar</button>
      <button type="button" class="btn btn-sm btn-ghost" data-act="stock">${p.available ? "Marcar agotado" : "Marcar disponible"}</button>
      <button type="button" class="btn btn-sm ${p.hidden ? "btn-dark" : "btn-danger"}" data-act="hide">${p.hidden ? "Mostrar" : "Deshabilitar"}</button>
    </div>
  </div>`;
}

function renderProductos() {
  const lista = productosFiltrados();
  const shown = lista.slice(0, prodVisible);
  $("#prodList").innerHTML = shown.length
    ? shown.map(prodHtml).join("")
    : '<p class="empty-state">Ningún producto coincide con la búsqueda.</p>';
  $("#prodCount").textContent = lista.length
    ? `Mostrando ${shown.length} de ${lista.length} productos`
    : "";
  $("#prodMoreBtn").hidden = shown.length >= lista.length;
}

async function guardarProducto(id, cambios) {
  const data = await api(`/api/admin/producto/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(cambios),
  });
  overrides[id] = data.item;
  renderProdStats();
  renderProductos();
}

async function restaurarProducto(id) {
  await api(`/api/admin/producto/${encodeURIComponent(id)}`, { method: "DELETE" });
  delete overrides[id];
  renderProdStats();
  renderProductos();
}

/* ---------- Modal de edición ---------- */
function abrirEditor(id) {
  const base = BASE_PRODUCTS.find((p) => p.id === id);
  if (!base) return;
  const p = merged(base);
  editingId = id;

  $("#editImg").src = p.images[0] || "";
  $("#editId").textContent = p.id;
  $("#editOrig").textContent = `Original: ${escapeHtml(base.title)} · ${money(base.priceNum)}`;
  $("#editError").hidden = true;

  // Ojo: se usa f.elements porque form.title y form.hidden son propiedades
  // propias del elemento HTML y no devolverían los campos del formulario.
  const f = $("#editForm").elements;
  f.title.value = p.title;
  f.priceNum.value = p.priceNum;
  f.compareAtPrice.value = p.compareAtPrice || "";
  f.description.value = p.description || "";
  f.available.checked = !!p.available;
  f.onSale.checked = !!p.onSale;
  f.hidden.checked = !!p.hidden;

  $("#resetProductBtn").hidden = !p._editado;
  $("#editModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function cerrarEditor() {
  $("#editModal").hidden = true;
  document.body.style.overflow = "";
  editingId = null;
}

/* ============================================================
   CUENTA Y USUARIOS
   ============================================================ */
async function cargarUsuarios() {
  try {
    const data = await api("/api/admin/usuarios");
    $("#usersList").innerHTML = data.usuarios.map((u) => `
      <div class="user-row">
        <div>
          <div class="user-name">${escapeHtml(u.user)}${u.user === data.actual ? " (tú)" : ""}</div>
          <div class="user-meta">${u.lastLogin ? "Último ingreso: " + fecha(u.lastLogin) : "Nunca ha ingresado"}</div>
        </div>
        ${u.user === data.actual ? "" : `<button type="button" class="btn btn-sm btn-danger" data-del-user="${escapeHtml(u.user)}">Quitar</button>`}
      </div>`).join("");
  } catch (e) {
    toast(e.message, true);
  }
}

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  // Verificar sesión
  try {
    const sesion = await api("/api/admin/sesion");
    $("#adminUser").textContent = sesion.usuario;
    if (sesion.mustChangePassword) {
      toast("Estás usando la contraseña inicial. Cámbiala en la pestaña Cuenta.", true);
    }
  } catch (e) {
    return; // api() ya redirige al login
  }

  cargarPedidos();
  cargarAjustes();
  cargarUsuarios();

  /* --- Pestañas --- */
  $$(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".admin-tab").forEach((t) => t.classList.toggle("active", t === tab));
      $$(".admin-view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab.dataset.tab));
      window.scrollTo({ top: 0 });
    });
  });

  /* --- Salir --- */
  $("#logoutBtn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  });

  /* --- Pedidos: filtros --- */
  $("#orderSearch").addEventListener("input", (e) => {
    orderSearch = e.target.value;
    renderPedidos();
  });
  $("#orderStatusChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    orderFilter = chip.dataset.status;
    $$("#orderStatusChips .chip").forEach((c) => c.classList.toggle("active", c === chip));
    renderPedidos();
  });
  $("#reloadOrdersBtn").addEventListener("click", cargarPedidos);
  $("#exportBtn").addEventListener("click", exportarCSV);

  /* --- Pedidos: acciones dentro de cada tarjeta --- */
  $("#ordersList").addEventListener("click", (e) => {
    const card = e.target.closest(".order-card");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.closest("[data-toggle]")) { card.classList.toggle("open"); return; }
    const statusBtn = e.target.closest("[data-status]");
    if (statusBtn) { cambiarPedido(id, { status: statusBtn.dataset.status }); return; }
    if (e.target.closest("[data-del]")) { borrarPedido(id); }
  });
  // Nota interna: se guarda al salir del campo
  $("#ordersList").addEventListener("change", (e) => {
    const input = e.target.closest("[data-nota]");
    if (!input) return;
    const card = input.closest(".order-card");
    cambiarPedido(card.dataset.id, { nota: input.value });
  });

  /* --- Productos: filtros --- */
  $("#prodSearch").addEventListener("input", (e) => {
    prodSearch = e.target.value;
    prodVisible = 30;
    renderProductos();
  });
  $("#prodCat").addEventListener("change", (e) => {
    prodCat = e.target.value;
    prodVisible = 30;
    renderProductos();
  });
  $("#prodEstado").addEventListener("change", (e) => {
    prodEstado = e.target.value;
    prodVisible = 30;
    renderProductos();
  });
  $("#prodMoreBtn").addEventListener("click", () => {
    prodVisible += 30;
    renderProductos();
  });

  /* --- Productos: acciones rápidas --- */
  $("#prodList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".prod-row").dataset.id;
    const base = BASE_PRODUCTS.find((p) => p.id === id);
    if (!base) return;
    const p = merged(base);

    try {
      if (btn.dataset.act === "edit") return abrirEditor(id);
      if (btn.dataset.act === "stock") {
        await guardarProducto(id, { available: !p.available });
        toast(p.available ? "Marcado como agotado" : "Marcado como disponible");
      }
      if (btn.dataset.act === "hide") {
        await guardarProducto(id, { hidden: !p.hidden });
        toast(p.hidden ? "Producto visible de nuevo" : "Producto deshabilitado en la tienda");
      }
    } catch (err) {
      toast(err.message, true);
    }
  });

  /* --- Modal de edición --- */
  $$("[data-edit-close]").forEach((el) => el.addEventListener("click", cerrarEditor));
  $("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const f = e.target.elements;
    const err = $("#editError");
    err.hidden = true;

    const precio = parseInt(f.priceNum.value, 10);
    if (!Number.isFinite(precio) || precio < 0) {
      err.textContent = "Escribe un precio válido.";
      err.hidden = false;
      return;
    }
    try {
      await guardarProducto(editingId, {
        title: f.title.value,
        priceNum: precio,
        compareAtPrice: f.compareAtPrice.value === "" ? null : parseInt(f.compareAtPrice.value, 10),
        description: f.description.value,
        available: f.available.checked,
        onSale: f.onSale.checked,
        hidden: f.hidden.checked,
      });
      cerrarEditor();
      toast("Producto actualizado");
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
    }
  });
  $("#resetProductBtn").addEventListener("click", async () => {
    if (!editingId) return;
    if (!confirm("¿Devolver este producto a sus datos originales del catálogo?")) return;
    try {
      await restaurarProducto(editingId);
      cerrarEditor();
      toast("Producto restaurado");
    } catch (e) {
      toast(e.message, true);
    }
  });

  /* --- Cuenta: contraseña --- */
  $("#passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = form.elements;
    const err = $("#passwordError");
    err.hidden = true;
    err.classList.remove("form-ok");

    if (f.nueva.value !== f.repetir.value) {
      err.textContent = "Las contraseñas nuevas no coinciden.";
      err.hidden = false;
      return;
    }
    try {
      await api("/api/admin/password", {
        method: "POST",
        body: JSON.stringify({ actual: f.actual.value, nueva: f.nueva.value }),
      });
      form.reset();
      err.textContent = "✓ Contraseña actualizada.";
      err.classList.add("form-ok");
      err.hidden = false;
      toast("Contraseña actualizada");
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
    }
  });

  /* --- Cuenta: usuarios --- */
  $("#userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = form.elements;
    const err = $("#userError");
    err.hidden = true;
    try {
      await api("/api/admin/usuarios", {
        method: "POST",
        body: JSON.stringify({ usuario: f.usuario.value, password: f.password.value }),
      });
      form.reset();
      cargarUsuarios();
      toast("Acceso creado");
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
    }
  });
  $("#usersList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del-user]");
    if (!btn) return;
    const user = btn.dataset.delUser;
    if (!confirm(`¿Quitar el acceso de "${user}"?`)) return;
    try {
      await api(`/api/admin/usuarios/${encodeURIComponent(user)}`, { method: "DELETE" });
      cargarUsuarios();
      toast("Acceso eliminado");
    } catch (e2) {
      toast(e2.message, true);
    }
  });

  /* --- Escape cierra el modal --- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#editModal").hidden) cerrarEditor();
  });
});
