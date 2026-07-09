/* ============================================================
   FitStyle - Lógica del catálogo y pedidos por WhatsApp
   ============================================================ */

// >>> CONFIGURA AQUÍ TU NÚMERO (código de país + número, sin + ni espacios) <<<
const WHATSAPP_NUMBER = "573023958923"; // +57 302 395 8923

// >>> ZONAS DE ENVÍO Y COSTO (en pesos) <<<
// Turbaco: envío plano gratis.
// Cartagena: costo según barrio (entre más lejos, más caro).
const SHIPPING = {
  Turbaco: { type: "flat", cost: 0 },
  Cartagena: {
    type: "barrios",
    barrios: {
      "Alameda": 5000, "Ciudadela 2000": 5000, "Consolata": 5000, "María Cano": 5000,
      "Nazareno": 5000, "Recreo": 5000, "San Fernando": 5000,
      "Blas de Lezo": 6000, "Caracoles": 6000, "Carmelo": 6000, "El Milagro": 6000,
      "Jardines": 6000, "La Central": 6000, "La Princesa": 6000, "Parque Heredia": 6000,
      "Plan 400": 6000, "Plazuela": 6000, "Providencia": 6000, "San Pedro": 6000,
      "San Pedro Mártir": 6000, "Santa Lucía": 6000, "Santa Mónica": 6000,
      "Simón Bolívar": 6000, "Socorro": 6000,
      "Alpes": 7000, "San José de los Campanos": 7000, "Ternera": 7000,
      "Almirante Colón": 8000, "Buenos Aires": 8000, "Calamares": 8000, "Campestre": 8000,
      "Castellana": 8000, "Chapacua": 8000, "Chipre": 8000, "Ciudad Jardín": 8000,
      "Condominio Carioca": 8000, "Corales": 8000, "Ejecutivos": 8000, "El Country": 8000,
      "El Rodeo": 8000, "Escallón Villa": 8000, "La Campiña": 8000, "La Carolina": 8000,
      "La Troncal": 8000, "Las Gaviotas": 8000, "Las Delicias": 8000, "Los Almendros": 8000,
      "Los Cerezos": 8000, "Piedra Bolívar": 8000, "Santa Clara": 8000, "Tacarigua": 8000,
      "Villa Rosita": 8000, "Villa Grande 1 y 2": 8000, "Zaragocilla": 8000,
      "Urbanización Horizonte": 9000,
      "20 de Julio": 10000, "Alto Bosque": 10000, "Amberes": 10000, "Barrio España": 10000,
      "Bosque": 10000, "Boston": 10000, "Bruselas": 10000, "Chile": 10000,
      "Cuatro Vientos": 10000, "El Líbano": 10000, "María Auxiliadora": 10000,
      "Nuevo Bosque": 10000, "Palmeras": 10000, "Portales de Alicante": 10000,
      "San Isidro": 10000, "Villas de la Candelaria": 10000,
      "Bazurto": 12000, "El Prado": 12000, "Los Cerros": 12000, "Manga": 12000,
      "Martínez Martelo": 12000, "Olaya": 12000, "Pie de la Popa": 12000, "San Felipe": 12000,
      "El Pozón": 13000,
      "Cabrero": 14000, "Canapote": 14000, "Daniel Lemaitre": 14000, "La Candelaria": 14000,
      "La Esperanza": 14000, "La María": 14000, "Marbella": 14000, "Paseo Bolívar": 14000,
      "San Francisco": 14000, "Torices": 14000,
      "Bicentenario": 16000,
      "Bocagrande": 17000, "Crespo": 17000, "Laguito": 17000,
      "Castillo Grande": 18000,
    },
  },
};

// Ícono de llama (SVG) reutilizado en insignias de oferta
const FLAME_SVG = '<svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd"/></svg>';

const PRODUCTS = window.PRODUCTS || [];

// Nombres visibles de categorías
const CAT_NAMES = {
  mujer: "Mujer",
  hombre: "Hombre",
  accesorios: "Accesorios",
  deportes: "Deportes",
  ninos: "Niños",
};

// Mensaje personalizado por categoría (se completa con los datos del formulario)
const CAT_INTRO = {
  mujer:      "💖 ¡Hola! Me encantó este producto y quiero pedirlo",
  hombre:     "💪 ¡Hola! Estoy interesado en este producto",
  accesorios: "🎒 ¡Hola! Me interesa este accesorio",
  deportes:   "🏋️ ¡Hola! Quiero hacer un pedido de este producto",
  ninos:      "🧒 ¡Hola! Quiero pedir este producto para niños",
  ofertas:    "🔥 ¡Hola! Vi esta oferta y quiero pedirla",
};

// Subcategorías por categoría (igual al menú del sitio original)
const SUBCATS = {
  hombre: ["Buzos & Chaquetas", "Camisetas & Camisillas", "Pantalonetas & Licras", "Sudaderas & Joggers"],
  mujer: ["Camisetas & Blusas", "Buzos & Chaquetas", "Crop Tops", "Tops", "Shorts & Bikers", "Falda Shorts & Enterizos", "Conjuntos", "Jogger & Sudaderas", "Leggins & Capris"],
  ninos: ["Niñas", "Niños"],
  accesorios: ["Medias", "Pantorrillera Compresión", "Sport Bag", "Guantes", "Straps Pesas", "Faja Cinturilla", "Sweatband Tenfit", "Pasamontañas", "Shaker Ultra", "Visor Ayra", "Scrunchie 3Pack"],
  deportes: ["Ciclismo", "Crossfit", "Fitness", "Tennis - Padel", "Running"],
};

/* ---------- Estado ---------- */
let currentCat = "all";
let currentSub = "";
let currentSearch = "";
let selectedProduct = null;
let cart = loadCart();

/* ---------- Carrito: persistencia ---------- */
function loadCart() {
  try { return JSON.parse(localStorage.getItem("fitstyle_cart")) || []; }
  catch (e) { return []; }
}
function saveCart() {
  try { localStorage.setItem("fitstyle_cart", JSON.stringify(cart)); }
  catch (e) { /* localStorage bloqueado (ej. file:// con protecciones de privacidad); el carrito sigue funcionando en memoria */ }
}

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function filteredProducts() {
  const q = currentSearch.trim().toLowerCase();
  // Las actividades deportivas (Ciclismo/Crossfit/Fitness/Tennis-Padel/Running) se solapan
  // con todas las categorías, así que cuando se filtra por una de ellas se busca en TODO
  // el catálogo por el campo "activity", ignorando la categoría principal.
  const isActivityFilter = currentSub && SUBCATS.deportes.includes(currentSub);
  return PRODUCTS.filter((p) => {
    const catOk = isActivityFilter ? true
      : currentCat === "all" ? true
      : currentCat === "ofertas" ? p.onSale
      : p.category === currentCat;
    const subOk = !currentSub ? true
      : isActivityFilter ? p.activity === currentSub
      : p.subcategory === currentSub;
    const searchOk = !q || p.title.toLowerCase().includes(q);
    return catOk && subOk && searchOk;
  });
}

/* ---------- Render de tarjetas (con carga progresiva) ---------- */
const PAGE_SIZE = 24;
let visibleCount = PAGE_SIZE;

function cardHtml(p) {
  const img0 = p.images[0];
  const img1 = p.images[1] || p.images[0];
  const badge = p.available
    ? '<span class="card-badge">Disponible</span>'
    : '<span class="card-badge out">Agotado</span>';
  const saleBadge = p.onSale ? '<span class="card-badge sale">' + FLAME_SVG + ' Oferta</span>' : "";
  return `
    <article class="card">
      <div class="card-img">
        ${badge}
        ${saleBadge}
        <img src="${img0}" alt="${escapeHtml(p.title)}" loading="lazy">
        <img src="${img1}" alt="" class="hover" loading="lazy">
      </div>
      <div class="card-body">
        <span class="card-cat">${CAT_NAMES[p.category] || ""}</span>
        <h3 class="card-title">${escapeHtml(p.title)}</h3>
        <p class="card-price">${p.compareAtPrice ? `<span class="compare-at">$${formatPrice(p.compareAtPrice)}</span>` : ""}$${p.price} <small>COP</small></p>
        <button class="card-btn" data-id="${p.id}">
          <svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.4.7 4.7 1.9 6.7L3 29l6.8-2.1c1.9 1 4 1.6 6.2 1.6 7 0 12.7-5.7 12.7-12.7C28.7 8.7 23 3 16 3z"/></svg>
          Pedir
        </button>
      </div>
    </article>`;
}

function renderProducts() {
  const grid = $("#productGrid");
  const items = filteredProducts();
  const empty = $("#emptyMsg");
  const countLabel = $("#resultCount");
  const loadMoreWrap = $("#loadMoreWrap");

  if (items.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    loadMoreWrap.hidden = true;
    countLabel.textContent = "";
    return;
  }
  empty.hidden = true;

  const shown = items.slice(0, visibleCount);
  grid.innerHTML = shown.map(cardHtml).join("");

  countLabel.textContent = `Mostrando ${shown.length} de ${items.length} productos`;
  loadMoreWrap.hidden = shown.length >= items.length;

  // Enlazar botones de pedido
  $$(".card-btn").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
  });
}

function loadMore() {
  visibleCount += PAGE_SIZE;
  renderProducts();
}

/* ---------- Hero slider ---------- */
let heroIndex = 0;
let heroTimer = null;
function initHeroSlider() {
  const slides = Array.from($$(".hero-slide"));
  const dotsWrap = $("#heroDots");
  if (!slides.length || !dotsWrap) return;

  dotsWrap.innerHTML = slides.map((_, i) => `<button type="button" class="hero-dot${i === 0 ? " active" : ""}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join("");
  const dots = Array.from($$(".hero-dot"));

  function goTo(i) {
    heroIndex = (i + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle("active", idx === heroIndex));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === heroIndex));
  }
  function next() { goTo(heroIndex + 1); }
  function restart() {
    clearInterval(heroTimer);
    heroTimer = setInterval(next, 5000);
  }

  dots.forEach((d) => d.addEventListener("click", () => { goTo(parseInt(d.dataset.i, 10)); restart(); }));
  restart();
}

/* ---------- Ofertas y promociones (banners reales, con precio real) ---------- */
const OFERTAS = [
  { id: "oferta-short-power-run", img: "images/ofertas/oferta-1-short-power-run.webp", title: "Short Power Run + Top de regalo (aplica referencias seleccionadas)", priceNum: 40000, before: null },
  { id: "oferta-buzos-hombre", img: "images/ofertas/oferta-2-buzos-compresion-hombre.png", title: "Pack x3 Buzos de Compresión Hombre", priceNum: 50000, before: 75000 },
  { id: "oferta-buzos-mujer", img: "images/ofertas/oferta-3-buzos-compresion-mujer.png", title: "Pack x3 Buzos de Compresión Mujer", priceNum: 50000, before: 75000 },
  { id: "oferta-camiseta-fist", img: "images/ofertas/oferta-4-camiseta-fist.png", title: "Camiseta Fist Microfibra", priceNum: 15000, before: 26000 },
  { id: "oferta-jogger-latam", img: "images/ofertas/oferta-5-jogger-latam.png", title: "Jogger Latam Unisex", priceNum: 25000, before: 37000 },
  { id: "oferta-top-paula", img: "images/ofertas/oferta-6-top-paula.png", title: "Pack x3 Top Paula", priceNum: 20000, before: 42000 },
  { id: "oferta-top-copa", img: "images/ofertas/oferta-7-top-copa-microfibra.png", title: "Pack x3 Top Copa Microfibra", priceNum: 20000, before: 42000 },
  { id: "oferta-falda-tradicional", img: "images/ofertas/oferta-8-falda-short-tradicional.png", title: "Pack x2 Falda Short Tradicional", priceNum: 30000, before: 46000 },
  { id: "oferta-esqueleto-cola-volada", img: "images/ofertas/oferta-9-esqueleto-cola-volada.png", title: "Pack x2 Esqueleto Cola Volada", priceNum: 25000, before: 30000 },
  { id: "oferta-pantaloneta-james", img: "images/ofertas/oferta-10-pantaloneta-james.png", title: "Pack x2 Pantaloneta James", priceNum: 40000, before: 54000 },
];

function renderOfertas() {
  const grid = $("#ofertasGrid");
  if (!grid) return;
  grid.innerHTML = OFERTAS.map((o, i) => `
    <article class="oferta-card" data-i="${i}">
      <div class="oferta-img"><img src="${o.img}" alt="${escapeHtml(o.title)}" loading="lazy"></div>
      <div class="oferta-body">
        <p class="oferta-title">${escapeHtml(o.title)}</p>
        <p class="oferta-price">
          ${o.before ? `<span class="oferta-before">$${formatPrice(o.before)}</span>` : ""}
          <span class="oferta-now">$${formatPrice(o.priceNum)}</span>
        </p>
        <button type="button" class="oferta-btn" data-i="${i}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          Agregar al pedido
        </button>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll(".oferta-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const o = OFERTAS[btn.dataset.i];
      const existing = cart.find((it) => it.id === o.id);
      if (existing) {
        existing.cantidad += 1;
      } else {
        cart.push({
          id: o.id,
          title: o.title,
          price: formatPrice(o.priceNum),
          priceNum: o.priceNum,
          category: "ofertas",
          image: o.img,
          talla: "",
          cantidad: 1,
        });
      }
      saveCart();
      updateCartCount();
      showToast(`✓ ${o.title} agregado al pedido`);
    });
  });
}

/* ---------- Grilla de productos en oferta real (compare_at_price) ---------- */
const SALE_PAGE_SIZE = 24;
let saleVisibleCount = SALE_PAGE_SIZE;

function renderSaleGrid() {
  const grid = $("#saleGrid");
  if (!grid) return;
  const items = PRODUCTS.filter((p) => p.onSale && p.compareAtPrice);
  const countLabel = $("#saleResultCount");
  const loadMoreWrap = $("#saleLoadMoreWrap");

  if (items.length === 0) {
    grid.innerHTML = "";
    loadMoreWrap.hidden = true;
    countLabel.textContent = "";
    return;
  }

  const shown = items.slice(0, saleVisibleCount);
  grid.innerHTML = shown.map(cardHtml).join("");
  countLabel.textContent = `${items.length} productos con descuento real`;
  loadMoreWrap.hidden = shown.length >= items.length;

  grid.querySelectorAll(".card-btn").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
  });
}

function loadMoreSale() {
  saleVisibleCount += SALE_PAGE_SIZE;
  renderSaleGrid();
}

/* ---------- Franjas destacadas (Nuevos Lanzamientos / Más Vendidos / Leggins) ---------- */
function renderStrip(containerId, handles) {
  const wrap = $(containerId);
  if (!wrap || !window.FEATURED) return;
  const byId = {};
  PRODUCTS.forEach((p) => { byId[p.id] = p; });
  const items = handles.map((h) => byId[h]).filter(Boolean);
  wrap.innerHTML = items.map(cardHtml).join("");
  wrap.querySelectorAll(".card-btn").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.id));
  });
}

function renderFeaturedStrips() {
  if (!window.FEATURED) return;
  renderStrip("#stripNuevos", window.FEATURED.nuevos || []);
  renderStrip("#stripLeggins", window.FEATURED.leggins || []);
  renderStrip("#stripVendidos", window.FEATURED.vendidos || []);
}

// Flechas de navegación de las franjas (Nuevos Lanzamientos, Leggins, Más Vendidos)
function initStripArrows() {
  $$(".strip-arrow").forEach((btn) => {
    btn.addEventListener("click", () => {
      const strip = document.getElementById(btn.dataset.strip);
      if (!strip) return;
      const amount = strip.clientWidth * 0.8;
      const dir = btn.classList.contains("strip-arrow-prev") ? -1 : 1;
      strip.scrollBy({ left: amount * dir, behavior: "smooth" });
    });
  });
}

/* ---------- Categorías destacadas ---------- */
function renderCategorias() {
  const grid = $("#catGrid");
  const cats = ["mujer", "hombre", "ninos", "accesorios", "deportes"];
  grid.innerHTML = cats.map((cat) => {
    const sample = PRODUCTS.find((p) => p.category === cat);
    const img = sample ? sample.images[0] : "";
    return `
      <div class="cat-card" data-cat="${cat}" style="--cat-accent: var(--c-${cat})">
        <img src="${img}" alt="${CAT_NAMES[cat]}" loading="lazy">
        <span>${CAT_NAMES[cat]}</span>
      </div>`;
  }).join("");

  $$(".cat-card").forEach((c) => {
    c.addEventListener("click", () => {
      setCategory(c.dataset.cat);
      $("#catalogo").scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ---------- Filtros / categorías ---------- */
const CAT_LABELS = { ...CAT_NAMES, ofertas: "🔥 Ofertas" };

function setCategory(cat, sub) {
  currentCat = cat;
  currentSub = sub || "";
  visibleCount = PAGE_SIZE;
  $$(".chip").forEach((ch) => ch.classList.toggle("active", ch.dataset.cat === cat));
  const titulo = $("#catalogoTitulo");
  titulo.textContent = cat === "all" ? "Nuestros productos" : CAT_LABELS[cat] || "Productos";
  renderSubFiltros();
  renderProducts();
}

// Muestra los chips de subcategoría según la categoría activa
function renderSubFiltros() {
  const wrap = $("#subFiltros");
  const subs = SUBCATS[currentCat];
  if (!subs || subs.length === 0) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }
  // Solo mostrar subcategorías que realmente tengan productos.
  // Deportes filtra por "activity" en TODO el catálogo (se solapa con otras categorías);
  // el resto filtra por "subcategory" dentro de su propia categoría.
  const available = currentCat === "deportes"
    ? subs.filter((s) => PRODUCTS.some((p) => p.activity === s))
    : subs.filter((s) => PRODUCTS.some((p) => p.category === currentCat && p.subcategory === s));
  if (available.length === 0) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }
  wrap.hidden = false;
  wrap.innerHTML = ['<button type="button" class="sub-chip' + (!currentSub ? " active" : "") + '" data-sub="">Todo</button>']
    .concat(available.map((s) => `<button type="button" class="sub-chip${s === currentSub ? " active" : ""}" data-sub="${escapeHtml(s)}">${escapeHtml(s)}</button>`))
    .join("");
  wrap.querySelectorAll(".sub-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSub = btn.dataset.sub;
      visibleCount = PAGE_SIZE;
      wrap.querySelectorAll(".sub-chip").forEach((b) => b.classList.toggle("active", b === btn));
      renderProducts();
    });
  });
}

/* ---------- Modal de pedido ---------- */
function openModal(id) {
  selectedProduct = PRODUCTS.find((p) => p.id === id);
  if (!selectedProduct) return;
  const p = selectedProduct;

  $("#modalImg").src = p.images[0];
  $("#modalImg").alt = p.title;
  $("#modalCat").textContent = CAT_NAMES[p.category] || "";
  $("#modalTitle").textContent = p.title;
  $("#modalPrice").textContent = `$${p.price} COP`;
  $("#modalDesc").textContent = p.description || "";

  // Disponibilidad
  const avail = $("#modalAvail");
  avail.textContent = p.available ? "● Disponible" : "● Agotado";
  avail.className = "detail-avail " + (p.available ? "ok" : "no");

  // Miniaturas (galería)
  const thumbs = $("#modalThumbs");
  thumbs.innerHTML = p.images.map((src, i) =>
    `<img src="${src}" alt="" class="${i === 0 ? "active" : ""}" data-src="${src}">`
  ).join("");
  thumbs.querySelectorAll("img").forEach((th) => {
    th.addEventListener("click", () => {
      $("#modalImg").src = th.dataset.src;
      thumbs.querySelectorAll("img").forEach((x) => x.classList.remove("active"));
      th.classList.add("active");
    });
  });

  // Poblar tallas
  const tallaSel = $("#tallaSelect");
  const sizes = selectedProduct.sizes && selectedProduct.sizes.length
    ? selectedProduct.sizes
    : ["Única / a convenir"];
  tallaSel.innerHTML = sizes.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  $("#orderForm").reset();
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
  selectedProduct = null;
}

/* ---------- Agregar al carrito (desde el modal) ---------- */
function handleAddToCart(e) {
  e.preventDefault();
  if (!selectedProduct) return;
  const p = selectedProduct;
  const form = e.target;
  const talla = form.querySelector('[name="talla"]').value || "";
  const cantidad = Math.max(1, parseInt(form.querySelector('[name="cantidad"]').value, 10) || 1);

  // Si ya existe el mismo producto+talla, suma la cantidad
  const existing = cart.find((it) => it.id === p.id && it.talla === talla);
  if (existing) {
    existing.cantidad += cantidad;
  } else {
    cart.push({
      id: p.id,
      title: p.title,
      price: p.price,
      priceNum: p.priceNum,
      category: p.category,
      image: p.images[0],
      talla: talla,
      cantidad: cantidad,
    });
  }
  saveCart();
  renderCart();
  updateCartCount();
  closeModal();
  showToast(`✓ ${p.title} agregado al pedido`);
}

/* ---------- Render del carrito ---------- */
function renderCart() {
  const wrap = $("#cartItems");
  const empty = $("#cartEmpty");
  const footer = $("#cartFooter");

  if (cart.length === 0) {
    wrap.innerHTML = "";
    empty.hidden = false;
    footer.hidden = true;
    return;
  }
  empty.hidden = true;
  footer.hidden = false;

  wrap.innerHTML = cart.map((it, i) => `
    <div class="cart-item">
      <img src="${it.image}" alt="${escapeHtml(it.title)}">
      <div class="cart-item-info">
        <div class="cart-item-title">${it.category === "ofertas" ? FLAME_SVG + " " : ""}${escapeHtml(it.title)}</div>
        <div class="cart-item-meta">${it.talla ? "Talla: " + escapeHtml(it.talla) + " · " : ""}$${it.price} c/u</div>
        <div class="cart-qty">
          <button type="button" data-act="dec" data-i="${i}" aria-label="Menos">−</button>
          <span>${it.cantidad}</span>
          <button type="button" data-act="inc" data-i="${i}" aria-label="Más">+</button>
        </div>
      </div>
      <div style="text-align:right; display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end;">
        <button class="cart-item-remove" data-act="del" data-i="${i}">Quitar</button>
        <span class="cart-item-price">$${formatPrice(it.priceNum * it.cantidad)}</span>
      </div>
    </div>
  `).join("");

  // Subtotal + envío + total
  updateTotals();

  // Botones de cantidad / quitar
  wrap.querySelectorAll("button[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = parseInt(b.dataset.i, 10);
      const act = b.dataset.act;
      if (act === "inc") cart[i].cantidad++;
      else if (act === "dec") cart[i].cantidad = Math.max(1, cart[i].cantidad - 1);
      else if (act === "del") cart.splice(i, 1);
      saveCart();
      renderCart();
      updateCartCount();
    });
  });
}

function cartTotal() {
  return cart.reduce((sum, it) => sum + it.priceNum * it.cantidad, 0);
}

// Puebla el selector de barrios de Cartagena, ordenado por precio y luego alfabético
function populateBarrios() {
  const sel = $("#barrioSelect");
  const barrios = SHIPPING.Cartagena.barrios;
  const entries = Object.entries(barrios).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  sel.innerHTML = '<option value="" disabled selected>Selecciona tu barrio</option>' +
    entries.map(([name, cost]) => `<option value="${escapeHtml(name)}">${escapeHtml(name)} — $${formatPrice(cost)}</option>`).join("");
}

// Muestra/oculta el selector de barrio según la ciudad elegida
function handleCiudadChange() {
  const ciudad = $("#ciudadSelect").value;
  const wrap = $("#barrioWrap");
  const barrioSel = $("#barrioSelect");
  if (ciudad === "Cartagena") {
    wrap.hidden = false;
    barrioSel.required = true;
    if (!barrioSel.options.length) populateBarrios();
  } else {
    wrap.hidden = true;
    barrioSel.required = false;
    barrioSel.value = "";
  }
  updateTotals();
}

// Calcula el costo de envío según ciudad (y barrio, si es Cartagena)
function getShippingCost() {
  const ciudad = $("#ciudadSelect") ? $("#ciudadSelect").value : "";
  if (ciudad === "Turbaco") return { known: true, cost: 0, label: "GRATIS" };
  if (ciudad === "Cartagena") {
    const barrio = $("#barrioSelect").value;
    if (!barrio) return { known: false, cost: 0, label: "Selecciona tu barrio" };
    const cost = SHIPPING.Cartagena.barrios[barrio];
    return { known: true, cost, label: `$${formatPrice(cost)}` };
  }
  return { known: false, cost: 0, label: "Elige tu ciudad" };
}

// Actualiza subtotal, envío y total según ciudad/barrio seleccionados
function updateTotals() {
  const subtotal = cartTotal();
  $("#cartSubtotal").textContent = `$${formatPrice(subtotal)}`;

  const ship = getShippingCost();
  const shipEl = $("#cartShipping");
  shipEl.textContent = ship.label;
  shipEl.className = ship.known && ship.cost === 0 ? "free" : "";

  const total = subtotal + (ship.known ? ship.cost : 0);
  $("#cartTotal").textContent = `$${formatPrice(total)} COP`;
}
function cartCount() {
  return cart.reduce((sum, it) => sum + it.cantidad, 0);
}
function updateCartCount() {
  const el = $("#cartCount");
  const n = cartCount();
  el.textContent = n;
  el.classList.toggle("hidden", n === 0);
}
function formatPrice(n) {
  return n.toLocaleString("es-CO");
}

/* ---------- Enviar el pedido completo por WhatsApp ---------- */
function buildOrderMessage(data) {
  const lines = ["🛍️ *NUEVO PEDIDO* 🛍️", ""];
  cart.forEach((it, idx) => {
    const prefix = it.category === "ofertas" ? "🔥 " : "";
    lines.push(`*${idx + 1}. ${prefix}${it.title}*`);
    lines.push(`   • Cantidad: ${it.cantidad}${it.talla ? "  |  Talla: " + it.talla : ""}`);
    lines.push(`   • Precio: $${it.price} c/u  →  $${formatPrice(it.priceNum * it.cantidad)}`);
    lines.push("");
  });

  const subtotal = cartTotal();
  const zona = data.ciudad === "Cartagena" ? `Cartagena - ${data.barrio}` : data.ciudad;
  lines.push(`🧾 *Subtotal:* $${formatPrice(subtotal)} COP`);
  if (data.shipCost === 0) {
    lines.push(`🚚 *Envío (${zona}):* GRATIS`);
  } else {
    lines.push(`🚚 *Envío (${zona}):* $${formatPrice(data.shipCost)} COP`);
  }
  lines.push(`💵 *TOTAL: $${formatPrice(subtotal + data.shipCost)} COP*`);

  lines.push("");
  lines.push("— — — — —");
  lines.push(`👤 *Nombre:* ${data.nombre}`);
  lines.push(`📍 *Ciudad:* ${zona}`);
  if (data.direccion) lines.push(`🏠 *Dirección:* ${data.direccion}`);
  if (data.comentario) lines.push(`📝 *Comentario:* ${data.comentario}`);
  lines.push("");
  lines.push("¡Gracias! Quedo atento/a a la confirmación. 🙌");
  return lines.join("\n");
}

function handleCheckout(e) {
  e.preventDefault();
  if (cart.length === 0) return;

  const ship = getShippingCost();
  if (!ship.known) {
    showToast("Selecciona tu ciudad" + ($("#ciudadSelect").value === "Cartagena" ? " y barrio" : ""));
    return;
  }

  const form = e.target;
  const data = {
    nombre: form.querySelector('[name="nombre"]').value.trim(),
    ciudad: $("#ciudadSelect").value,
    barrio: $("#barrioSelect") ? $("#barrioSelect").value : "",
    direccion: form.querySelector('[name="direccion"]').value.trim(),
    comentario: form.querySelector('[name="comentario"]').value.trim(),
    shipCost: ship.cost,
  };
  const text = buildOrderMessage(data);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

/* ---------- Abrir / cerrar carrito ---------- */
function openCart() {
  renderCart();
  $("#cartDrawer").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeCart() {
  $("#cartDrawer").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- Políticas (modal informativo) ---------- */
const POLICIES = {
  envios: {
    title: "Envíos y Entregas",
    body: `
      <p>Realizamos entregas en <strong>Turbaco</strong> (envío GRATIS) y en <strong>Cartagena</strong> (costo según el barrio, calculado automáticamente en tu carrito).</p>
      <p>Los pedidos se despachan una vez confirmado el pago o el acuerdo de pago contra entrega por WhatsApp.</p>
      <p>El tiempo estimado de entrega es de 24 a 72 horas hábiles, dependiendo de la zona y disponibilidad.</p>
    `,
  },
  cambios: {
    title: "Cambios y Devoluciones",
    body: `
      <p>Aceptamos cambios por talla o color dentro de los <strong>5 días</strong> posteriores a la entrega, siempre que el producto esté sin uso y con sus etiquetas originales.</p>
      <p>Para solicitar un cambio, escríbenos por WhatsApp indicando tu número de pedido.</p>
      <p>No se realizan devoluciones de dinero, solo cambios por otro producto de igual o mayor valor.</p>
    `,
  },
  comprar: {
    title: "Cómo Comprar",
    body: `
      <p>1. Explora el catálogo y elige tus productos favoritos.</p>
      <p>2. Selecciona talla y cantidad, y agrégalos a tu pedido.</p>
      <p>3. Abre tu carrito, completa tus datos de entrega (ciudad y barrio).</p>
      <p>4. Confirma y te llevará directo a WhatsApp con tu pedido listo para enviar.</p>
      <p>5. Coordinamos contigo el pago y la entrega. ¡Así de fácil!</p>
    `,
  },
};

function openPolicy(key) {
  const p = POLICIES[key];
  if (!p) return;
  $("#policyTitle").textContent = p.title;
  $("#policyBody").innerHTML = p.body;
  $("#policyModal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closePolicy() {
  $("#policyModal").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Utilidades ---------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Menú desplegable de subcategorías (header) ---------- */
function renderNavDropdowns() {
  Object.keys(SUBCATS).forEach((cat) => {
    const dd = document.getElementById(`dropdown-${cat}`);
    if (!dd) return;
    dd.innerHTML = SUBCATS[cat]
      .map((s) => `<a href="#" data-cat="${cat}" data-sub="${escapeHtml(s)}" class="dropdown-link">${escapeHtml(s)}</a>`)
      .join("");
  });
}

function closeAllDropdowns() {
  $$(".nav-item.open").forEach((i) => i.classList.remove("open"));
}

/* ---------- Inicialización ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderCategorias();
  renderNavDropdowns();
  renderProducts();

  renderOfertas();
  renderSaleGrid();
  renderFeaturedStrips();
  initStripArrows();
  initHeroSlider();

  // Filtros (chips)
  $$(".chip").forEach((ch) => ch.addEventListener("click", () => {
    if (ch.dataset.cat === "ofertas") {
      $("#ofertas").scrollIntoView({ behavior: "smooth" });
      return;
    }
    setCategory(ch.dataset.cat);
  }));
  $("#loadMoreBtn").addEventListener("click", loadMore);
  $("#saleLoadMoreBtn").addEventListener("click", loadMoreSale);

  // Botones de categoría con submenú (Hombre / Mujer / Niños / Accesorios)
  $$(".nav-drop-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const item = btn.closest(".nav-item");
      const wasOpen = item.classList.contains("open");
      closeAllDropdowns();
      item.classList.toggle("open", !wasOpen);
      setCategory(btn.dataset.cat);
      $("#catalogo").scrollIntoView({ behavior: "smooth" });
    });
  });

  // Links dentro del submenú (subcategorías)
  $$(".dropdown-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setCategory(link.dataset.cat, link.dataset.sub);
      $("#catalogo").scrollIntoView({ behavior: "smooth" });
      closeAllDropdowns();
      $("#nav").classList.remove("open");
    });
  });

  // Cierra los submenús al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-item")) closeAllDropdowns();
  });

  // Navegación por categoría simple (Inicio, Deportes, Ofertas, footer)
  $$("[data-cat]").forEach((el) => {
    if (el.classList.contains("chip") || el.classList.contains("cat-card")) return;
    if (el.classList.contains("nav-drop-btn") || el.classList.contains("dropdown-link")) return;
    el.addEventListener("click", (e) => {
      const cat = el.dataset.cat;
      if (cat === "ofertas") {
        e.preventDefault();
        $("#ofertas").scrollIntoView({ behavior: "smooth" });
      } else if (cat && cat !== "all") {
        e.preventDefault();
        setCategory(cat);
        $("#catalogo").scrollIntoView({ behavior: "smooth" });
      }
      $("#nav").classList.remove("open");
      closeAllDropdowns();
    });
  });

  // Búsqueda
  $("#search").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    visibleCount = PAGE_SIZE;
    renderProducts();
  });

  // Menú móvil
  $("#menuToggle").addEventListener("click", () => $("#nav").classList.toggle("open"));

  // Modal (agregar al carrito)
  $("#orderForm").addEventListener("submit", handleAddToCart);
  $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));

  // Modal de políticas (footer)
  $$("[data-policy]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openPolicy(el.dataset.policy);
    });
  });
  $$("[data-policy-close]").forEach((el) => el.addEventListener("click", closePolicy));

  // Carrito
  updateCartCount();
  $("#cartBtn").addEventListener("click", openCart);
  $("#checkoutForm").addEventListener("submit", handleCheckout);
  $("#ciudadSelect").addEventListener("change", handleCiudadChange);
  $("#barrioSelect").addEventListener("change", updateTotals);
  $$("[data-cart-close]").forEach((el) => el.addEventListener("click", closeCart));

  // Tecla Escape cierra lo que esté abierto
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#modal").hidden) closeModal();
    else if (!$("#cartDrawer").hidden) closeCart();
    else if (!$("#policyModal").hidden) closePolicy();
  });

  // Año footer
  $("#year").textContent = new Date().getFullYear();
});
