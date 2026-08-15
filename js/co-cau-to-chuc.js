/* =======================================================
   FILE: co-cau-to-chuc.js
   MỤC ĐÍCH: Lấy danh sách MỤC (org_positions, có parent_id) và
   vẽ SƠ ĐỒ CÂY. Bấm vào 1 mục -> mở KHUNG CHÍNH gồm 2 cột:
     - TRÁI: danh sách THẺ NHỎ (ảnh + chức vụ + tên) của từng
       chỉ huy thuộc mục đó (org_position_leaders). Bấm vào 1
       thẻ -> mở KHUNG CHI TIẾT RIÊNG của người đó (ảnh to +
       chức vụ + tên + giới thiệu riêng).
     - PHẢI: giới thiệu CHUNG của CHÍNH mục đó
       (org_positions.description).

   Cần: js/supabase-config.js (biến supabaseClient) nạp TRƯỚC.
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  loadOrgPositions();

  // KHÔNG gọi lại initMobileNav()/initBackToTop()/setFooterYear() —
  // main.js đã gọi sẵn rồi.
  initOrgDetailModal();
  initOrgLeaderDetailModal();
});

/* --------- Lấy dữ liệu từ Supabase --------- */
async function loadOrgPositions() {
  const container = document.getElementById("orgPositionsList");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("org_positions")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    container.innerHTML =
      '<p class="loading-text">Không tải được dữ liệu. Vui lòng thử lại sau.</p>';
    console.error("Lỗi tải org_positions:", error);
    return;
  }

  renderOrgPositions(data);
}

let allOrgPositions = [];

/* --------- Dựng CÂY từ danh sách phẳng (dựa vào parent_id) --------- */
function buildOrgTree(positions) {
  const map = {};
  positions.forEach((p) => {
    map[p.id] = { ...p, children: [] };
  });

  const roots = [];

  positions.forEach((p) => {
    if (p.parent_id && map[p.parent_id]) {
      map[p.parent_id].children.push(map[p.id]);
    } else {
      roots.push(map[p.id]);
    }
  });

  return roots;
}

/* --------- Vẽ sơ đồ cây ra màn hình --------- */
function renderOrgPositions(positions) {
  const container = document.getElementById("orgPositionsList");
  allOrgPositions = positions || [];

  if (!positions || positions.length === 0) {
    container.innerHTML =
      '<p class="loading-text">Chưa có thông tin cơ cấu tổ chức.</p>';
    return;
  }

  const roots = buildOrgTree(positions);

  if (roots.length === 0) {
    container.innerHTML =
      '<p class="loading-text">Dữ liệu cơ cấu tổ chức chưa hợp lệ (không tìm thấy gốc của cây).</p>';
    return;
  }

  container.innerHTML = `
    <div class="org-tree-chart">
      ${roots.map((root) => renderOrgRootNode(root)).join("")}
    </div>
  `;

  attachOrgTreeEvents();

  // MỚI: tự động thu nhỏ sơ đồ vừa khít khung hiển thị, không cần
  // vuốt/kéo ngang nữa. requestAnimationFrame để đảm bảo trình duyệt
  // đã vẽ xong DOM ở trên rồi mới đo kích thước, tránh đo sai lúc 0px.
  requestAnimationFrame(fitOrgTreeChart);
}

function renderOrgRootNode(root) {
  const hasChildren = root.children && root.children.length > 0;
  return `
    <div class="org-tree-root-row">
      <div class="org-tree-root-box" data-id="${root.id}">${root.title}</div>
    </div>
    ${hasChildren ? renderOrgBranchesRow(root.children) : ""}
  `;
}

function renderOrgBranchesRow(branches) {
  return `
    <ul class="org-tree-branches-row">
      ${branches.map((branch) => renderOrgBranchNode(branch)).join("")}
    </ul>
  `;
}

function renderOrgBranchNode(branch) {
  const children = branch.children || [];
  const hasChildren = children.length > 0;

  const hasGrandchildren = children.some(
    (c) => c.children && c.children.length > 0
  );

  return `
    <li class="org-tree-branch">
      <span class="org-tree-branch-label" data-id="${branch.id}">${branch.title}</span>
      ${hasChildren ? '<span class="org-tree-arrow-down"></span>' : ""}
      ${
        hasChildren
          ? hasGrandchildren
            ? renderOrgBranchesRow(children)
            : renderOrgStackBox(children)
          : ""
      }
    </li>
  `;
}

function renderOrgStackBox(items) {
  return `
    <div class="org-tree-stack-box">
      ${items
        .map(
          (item) => `
        <div class="org-tree-stack-item" data-id="${item.id}">
          <span class="org-tree-stack-item-title">${item.title}</span>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

/* --------- Bấm vào bất kỳ ô nào trên cây -> mở khung chính --------- */
function attachOrgTreeEvents() {
  document.querySelectorAll("#orgPositionsList [data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const position = allOrgPositions.find((p) => p.id == id);
      if (position) openOrgDetailModal(position);
    });
  });
}

/* =======================================================
   MỚI: TỰ ĐỘNG THU NHỎ (SCALE) SƠ ĐỒ VỪA KHÍT KHUNG HIỂN THỊ
   Đo chiều rộng THẬT của sơ đồ (chưa bị ép co) so với chiều rộng
   khung đang có (#orgPositionsList), rồi tự áp transform: scale()
   để toàn bộ sơ đồ luôn hiện đủ trong màn hình, không cần cuộn/vuốt
   ngang nữa — chạy được cả trên máy tính lẫn điện thoại.
   ======================================================= */
function fitOrgTreeChart() {
  const wrapper = document.getElementById("orgPositionsList");
  const chart = wrapper ? wrapper.querySelector(".org-tree-chart") : null;
  if (!wrapper || !chart) return;

  // Ép trực tiếp các thuộc tính cần thiết bằng inline style — inline
  // style LUÔN thắng bất kỳ rule nào trong style.css, nên không còn
  // phụ thuộc vào thứ tự các đoạn CSS đã dán trước đó nữa.
  wrapper.style.display = "block";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "hidden";
  wrapper.style.position = "relative";

  // Reset về trạng thái TỰ NHIÊN (zoom 1, rộng đúng theo nội dung, chưa
  // bị ép co) để đo đúng kích thước thật cần thiết.
  chart.style.display = "block";
  chart.style.zoom = 1;
  chart.style.width = "max-content";
  chart.style.maxWidth = "none";
  chart.style.margin = "0 auto";

  const naturalWidth = chart.offsetWidth;
  const availableWidth = wrapper.clientWidth;
  if (!naturalWidth || !availableWidth) return;

  // Chỉ THU NHỎ khi sơ đồ rộng hơn khung nhìn, không phóng to quá 1.
  // Dùng "zoom" thay vì "transform: scale()": zoom tính lại layout THẬT
  // (không chỉ vẽ lại nhìn nhỏ hơn), nên không bị lỗi co 2 lần / lệch
  // tâm như transform, và không cần tự tính margin/chiều cao bù trừ nữa
  // — trình duyệt tự lo phần đó.
  const scale = Math.min(1, availableWidth / naturalWidth);
  chart.style.zoom = scale;
}

// Tính lại tỉ lệ mỗi khi đổi kích thước cửa sổ / xoay ngang-dọc điện
// thoại. Dùng debounce (setTimeout) để tránh tính lại quá nhiều lần
// liên tục trong lúc đang kéo giãn cửa sổ, gây giật/lag.
let orgTreeResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(orgTreeResizeTimer);
  orgTreeResizeTimer = setTimeout(fitOrgTreeChart, 150);
});

// Font "Be Vietnam Pro" tải xong có thể đổi kích thước chữ trong sơ
// đồ -> đo lại cho chính xác sau khi font load xong, tránh tính scale
// sai lúc font hệ thống (fallback) còn đang hiển thị tạm.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitOrgTreeChart);
}

/* --------- Ảnh mặc định khi chưa có ảnh --------- */
const ORG_LEADER_PLACEHOLDER_IMG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNmY3Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Q2jGsGEgY8OzIOG6o25oPC90ZXh0Pjwvc3ZnPg==";

/* MỚI: giữ danh sách chỉ huy đang hiện trong khung chính, để khi
   bấm vào 1 thẻ nhỏ thì tìm đúng người đó mà mở khung chi tiết
   riêng, không cần gọi lại Supabase lần nữa. */
let currentModalLeaders = [];

/* --------- KHUNG CHÍNH: giới thiệu mục (phải) + danh sách chỉ huy (trái) --------- */
async function openOrgDetailModal(position) {
  const modal = document.getElementById("orgDetailModal");
  if (!modal) return;

  document.getElementById("orgDetailPositionTitle").textContent = position.title;

  // Giới thiệu CHUNG của chính mục này (org_positions.description)
  const descEl = document.getElementById("orgDetailPositionDesc");
  if (descEl) {
    const desc = (position.description || "").trim();
    descEl.textContent = desc || "Chưa có giới thiệu.";
  }

  const listEl = document.getElementById("orgDetailLeadersList");
  listEl.innerHTML = '<p class="loading-text">Đang tải...</p>';
  currentModalLeaders = [];

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  const { data, error } = await supabaseClient
    .from("org_position_leaders")
    .select("*")
    .eq("position_id", position.id)
    .order("display_order", { ascending: true });

  if (error) {
    listEl.innerHTML =
      '<p class="loading-text">Không tải được danh sách chỉ huy.</p>';
    console.error("Lỗi tải org_position_leaders:", error);
    return;
  }

  currentModalLeaders = data || [];

  if (currentModalLeaders.length === 0) {
    listEl.innerHTML =
      '<p class="loading-text">Chưa có thông tin chỉ huy cho mục này.</p>';
    return;
  }

  listEl.innerHTML = currentModalLeaders.map(renderLeaderMiniCardHTML).join("");
  attachLeaderMiniCardEvents();
}

/* Thẻ nhỏ ở cột trái: chỉ ảnh + chức vụ + tên, bấm vào để mở
   khung chi tiết riêng (có giới thiệu riêng) của người đó. */
function renderLeaderMiniCardHTML(leader) {
  return `
    <div class="org-leader-mini-card" data-leader-id="${leader.id}">
      <img
        src="${leader.image_url || ORG_LEADER_PLACEHOLDER_IMG}"
        alt="${escapeOrgHtml(leader.name || leader.title || "")}"
        class="org-leader-mini-photo"
      />
      <div class="org-leader-mini-info">
        ${leader.title ? `<span class="org-leader-mini-title">${escapeOrgHtml(leader.title)}</span>` : ""}
        <span class="org-leader-mini-name">${escapeOrgHtml(leader.name || "")}</span>
      </div>
    </div>
  `;
}

function attachLeaderMiniCardEvents() {
  document.querySelectorAll("#orgDetailLeadersList [data-leader-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const leaderId = el.dataset.leaderId;
      const leader = currentModalLeaders.find((l) => String(l.id) === String(leaderId));
      if (leader) openOrgLeaderDetailModal(leader);
    });
  });
}

// Chống lỗi hiển thị nếu tên/giới thiệu chứa ký tự HTML đặc biệt
function escapeOrgHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function closeOrgDetailModal() {
  const modal = document.getElementById("orgDetailModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function initOrgDetailModal() {
  const modal = document.getElementById("orgDetailModal");
  const closeBtn = document.getElementById("orgDetailClose");
  if (!modal || !closeBtn) return;

  closeBtn.addEventListener("click", closeOrgDetailModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeOrgDetailModal();
  });
}

/* --------- MỚI: KHUNG CHI TIẾT RIÊNG CỦA 1 CHỈ HUY --------- */
function openOrgLeaderDetailModal(leader) {
  const modal = document.getElementById("orgLeaderDetailModal");
  if (!modal) return;

  document.getElementById("orgLeaderDetailImg").src = leader.image_url || ORG_LEADER_PLACEHOLDER_IMG;
  document.getElementById("orgLeaderDetailImg").alt = leader.name || leader.title || "";
  document.getElementById("orgLeaderDetailTitle").textContent = leader.title || "";
  document.getElementById("orgLeaderDetailName").textContent = leader.name || "";
  document.getElementById("orgLeaderDetailBio").textContent = leader.bio || "Chưa có giới thiệu.";

  modal.hidden = false;
  // Không set lại overflow ở đây vì khung chính (orgDetailModal) đã
  // đang mở phía sau và đã ẩn scroll của body rồi.
}

function closeOrgLeaderDetailModal() {
  const modal = document.getElementById("orgLeaderDetailModal");
  if (!modal) return;
  modal.hidden = true;
}

function initOrgLeaderDetailModal() {
  const modal = document.getElementById("orgLeaderDetailModal");
  const closeBtn = document.getElementById("orgLeaderDetailClose");
  if (!modal || !closeBtn) return;

  closeBtn.addEventListener("click", closeOrgLeaderDetailModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeOrgLeaderDetailModal();
  });
}

/* --------- Phím Escape: đóng khung ĐANG MỞ TRÊN CÙNG trước --------- */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const leaderModal = document.getElementById("orgLeaderDetailModal");
  const mainModal = document.getElementById("orgDetailModal");

  if (leaderModal && !leaderModal.hidden) {
    closeOrgLeaderDetailModal();
  } else if (mainModal && !mainModal.hidden) {
    closeOrgDetailModal();
  }
});