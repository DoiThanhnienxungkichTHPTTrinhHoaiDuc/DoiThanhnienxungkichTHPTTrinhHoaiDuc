/* =======================================================
   FILE: admin-org.js
   MỤC ĐÍCH: CRUD cho "org_positions" (mục/khung trong sơ đồ
   cây, có thêm "description" = giới thiệu ngắn của CHÍNH mục)
   + "org_levels" (cấp bậc) + "org_position_leaders" (nhiều
   chỉ huy cho mỗi mục, sắp xếp được, mỗi người có chức vụ/
   tên/ảnh/giới thiệu riêng — KHÁC với giới thiệu của mục).

   Cần: supabase-config.js (biến supabaseClient) nạp trước.
   Tên bucket lưu ảnh: "org.images".
   Cần chạy trước 1 lần trong Supabase SQL Editor:
       alter table org_positions add column if not exists description text;
   ======================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  await loadLeaderCounts();
  loadLevels();
  loadPositions();
  initAddLevelForm();
  initAddForm();
});

let allOrgLevels = [];

/* =======================================================
   PHẦN 1: QUẢN LÝ CẤP BẬC (org_levels) — GIỮ NGUYÊN không đổi
   ======================================================= */
async function loadLevels() {
  const container = document.getElementById("levelsList");

  const { data, error } = await supabaseClient
    .from("org_levels")
    .select("*")
    .order("level_order", { ascending: true });

  if (error) {
    container.innerHTML = `<p class="admin-message admin-message-error">Lỗi tải danh sách cấp bậc: ${error.message}</p>`;
    return;
  }

  allOrgLevels = data || [];
  renderLevelsList();
  fillLevelSelects();
  renderPositionsList(allLoadedPositions);
}

function getEffectiveAvatarPx(level, index) {
  const virtualIndexMap = { large: 0, medium: 2, small: 5 };
  const i =
    level && level.card_size && virtualIndexMap[level.card_size] !== undefined
      ? virtualIndexMap[level.card_size]
      : index;
  return Math.max(84, 156 - i * 14);
}

function tierBadgeHTML(avatarPx) {
  let emoji = "⚪";
  let label = "Nhỏ";
  if (avatarPx >= 156) {
    emoji = "🥇";
    label = "To nhất";
  } else if (avatarPx >= 125) {
    emoji = "🥈";
    label = "Lớn";
  } else if (avatarPx >= 105) {
    emoji = "🥉";
    label = "Vừa";
  } else if (avatarPx >= 90) {
    label = "Nhỏ";
  } else {
    label = "Nhỏ nhất";
  }
  return `<span class="admin-level-size-badge">${emoji} ${label} (${avatarPx}px)</span>`;
}

function renderLevelsList() {
  const container = document.getElementById("levelsList");

  if (allOrgLevels.length === 0) {
    container.innerHTML =
      '<p class="loading-text">Chưa có cấp bậc nào. Thêm ở ô phía trên (VD: "Ban chỉ huy").</p>';
    return;
  }

  container.innerHTML = allOrgLevels
    .map((lv, index) => {
      const avatarPx = getEffectiveAvatarPx(lv, index);
      const sizeValue = lv.card_size || "auto";

      return `
      <div class="admin-level-row" data-id="${lv.id}">
        <div class="admin-level-order-controls">
          <button type="button" class="btn-level-up" ${index === 0 ? "disabled" : ""} title="Đưa cấp này lên cao hơn">▲</button>
          <button type="button" class="btn-level-down" ${
            index === allOrgLevels.length - 1 ? "disabled" : ""
          } title="Đưa cấp này xuống thấp hơn">▼</button>
        </div>
        <input type="text" class="input-level-name" value="${escapeHtml(lv.name)}" />

        <select class="input-level-size" title="Kích thước thẻ ở trang công khai">
          <option value="auto" ${sizeValue === "auto" ? "selected" : ""}>Tự động (theo thứ tự)</option>
          <option value="large" ${sizeValue === "large" ? "selected" : ""}>🥇 To nhất</option>
          <option value="medium" ${sizeValue === "medium" ? "selected" : ""}>🥈 Vừa</option>
          <option value="small" ${sizeValue === "small" ? "selected" : ""}>🥉 Nhỏ</option>
        </select>

        ${tierBadgeHTML(avatarPx)}

        <button type="button" class="btn btn-primary btn-save-level">💾 Lưu</button>
        <button type="button" class="btn btn-danger btn-delete-level">🗑️ Xóa</button>
      </div>
    `;
    })
    .join("");

  attachLevelRowEvents();
}

function initAddLevelForm() {
  const form = document.getElementById("addLevelForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("newLevelName");
    const name = nameInput.value.trim();
    if (!name) return;

    const maxOrder = allOrgLevels.reduce((max, lv) => Math.max(max, lv.level_order || 0), 0);

    const { error } = await supabaseClient.from("org_levels").insert({
      name,
      level_order: maxOrder + 1,
    });

    if (error) {
      alert("Lỗi thêm cấp bậc: " + error.message);
      return;
    }

    nameInput.value = "";
    loadLevels();
  });
}

function attachLevelRowEvents() {
  document.querySelectorAll(".btn-level-up").forEach((btn, index) => {
    btn.addEventListener("click", () => swapLevelOrder(index, index - 1));
  });
  document.querySelectorAll(".btn-level-down").forEach((btn, index) => {
    btn.addEventListener("click", () => swapLevelOrder(index, index + 1));
  });

  document.querySelectorAll(".btn-save-level").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".admin-level-row");
      const id = row.dataset.id;
      const name = row.querySelector(".input-level-name").value.trim();
      const cardSize = row.querySelector(".input-level-size").value;
      if (!name) return;

      btn.disabled = true;
      const { error } = await supabaseClient
        .from("org_levels")
        .update({ name, card_size: cardSize })
        .eq("id", id);
      btn.disabled = false;

      if (error) {
        alert("Lỗi lưu cấp bậc: " + error.message);
        return;
      }
      loadLevels();
    });
  });

  document.querySelectorAll(".btn-delete-level").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".admin-level-row");
      const id = row.dataset.id;
      const name = row.querySelector(".input-level-name").value;

      const confirmed = confirm(
        `Xóa cấp bậc "${name}"? Các chức vụ đang thuộc cấp này sẽ chuyển về mục "Chưa phân cấp" (không bị xóa).`
      );
      if (!confirmed) return;

      const { error } = await supabaseClient.from("org_levels").delete().eq("id", id);
      if (error) {
        alert("Lỗi xóa cấp bậc: " + error.message);
        return;
      }
      loadLevels();
      loadPositions();
    });
  });
}

async function swapLevelOrder(indexA, indexB) {
  if (indexB < 0 || indexB >= allOrgLevels.length) return;

  const levelA = allOrgLevels[indexA];
  const levelB = allOrgLevels[indexB];

  const { error } = await supabaseClient
    .from("org_levels")
    .update({ level_order: levelB.level_order })
    .eq("id", levelA.id);
  if (error) {
    alert("Lỗi đổi thứ tự cấp bậc: " + error.message);
    return;
  }

  await supabaseClient.from("org_levels").update({ level_order: levelA.level_order }).eq("id", levelB.id);

  loadLevels();
}

function fillLevelSelects() {
  document.querySelectorAll(".js-level-select").forEach((select) => {
    const currentValue = select.dataset.currentLevelId || select.value || "";
    select.innerHTML =
      '<option value="">-- Chưa phân cấp --</option>' +
      allOrgLevels.map((lv) => `<option value="${lv.id}">${escapeHtml(lv.name)}</option>`).join("");
    select.value = currentValue;
  });
}

/* =======================================================
   MỤC CHA (parent_id) — GIỮ NGUYÊN không đổi
   ======================================================= */
function buildPositionsTreeForSelect(positions) {
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

function flattenPositionsTree(nodes, depth, excludeId, output) {
  nodes.forEach((node) => {
    if (excludeId != null && String(node.id) === String(excludeId)) {
      return;
    }
    output.push({ id: node.id, title: node.title, depth });
    if (node.children && node.children.length > 0) {
      flattenPositionsTree(node.children, depth + 1, excludeId, output);
    }
  });
}

function fillParentSelects() {
  const tree = buildPositionsTreeForSelect(allLoadedPositions);

  document.querySelectorAll(".js-parent-select").forEach((select) => {
    const currentValue = select.dataset.currentParentId || select.value || "";
    const excludeId = select.dataset.excludeId || null;

    const flat = [];
    flattenPositionsTree(tree, 0, excludeId, flat);

    select.innerHTML =
      '<option value="">— (Gốc, không có cấp trên) —</option>' +
      flat
        .map(
          (n) =>
            `<option value="${n.id}">${"— ".repeat(n.depth)}${escapeHtml(n.title)}</option>`
        )
        .join("");
    select.value = currentValue;
  });
}

/* =======================================================
   PHẦN 2: MỤC TRONG SƠ ĐỒ CÂY (org_positions) — ĐỌC
   ======================================================= */
let allLoadedPositions = [];

async function loadPositions() {
  const container = document.getElementById("positionsList");

  const { data, error } = await supabaseClient
    .from("org_positions")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    container.innerHTML = `<p class="admin-message admin-message-error">Lỗi tải dữ liệu: ${error.message}</p>`;
    return;
  }

  allLoadedPositions = data || [];
  renderPositionsList(allLoadedPositions);
}

function renderPositionsList(positions) {
  const container = document.getElementById("positionsList");

  if (!positions) return;

  if (positions.length === 0) {
    container.innerHTML = '<p class="loading-text">Chưa có mục nào. Thêm mới ở form phía trên.</p>';
    return;
  }

  const groups = allOrgLevels.map((lv) => ({
    level: lv,
    items: positions.filter((p) => p.level_id === lv.id),
  }));

  const unassigned = positions.filter((p) => !p.level_id || !allOrgLevels.some((lv) => lv.id === p.level_id));
  if (unassigned.length > 0) {
    groups.push({ level: null, items: unassigned });
  }

  container.innerHTML = groups
    .map((group) => {
      const groupTitle = group.level ? escapeHtml(group.level.name) : "Chưa phân cấp";
      if (group.items.length === 0) return "";

      return `
        <div class="admin-level-group">
          <h3 class="admin-level-group-title">${groupTitle}</h3>
          <div class="admin-level-group-items">
            ${group.items.map((p, index) => renderPositionRowHTML(p, index, group.items.length)).join("")}
          </div>
        </div>
      `;
    })
    .join("");

  fillLevelSelects();
  fillParentSelects();
  attachRowEvents();
  attachLeadersToggleEvents();
}

const ADMIN_THUMB_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjZmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

function renderPositionRowHTML(p, indexInGroup, groupSize) {
  const leaderCount = leaderCountsByPosition[p.id] || 0;

  return `
    <div class="admin-position-row-wrapper">
      <div class="admin-position-row" data-id="${p.id}">
        <div class="admin-position-order-controls">
          <button type="button" class="btn-position-up" ${
            indexInGroup === 0 ? "disabled" : ""
          } title="Lên trước (trong cùng cấp bậc)">▲</button>
          <button type="button" class="btn-position-down" ${
            indexInGroup === groupSize - 1 ? "disabled" : ""
          } title="Xuống sau (trong cùng cấp bậc)">▼</button>
        </div>

        <img
          src="${p.image_url || ADMIN_THUMB_PLACEHOLDER}"
          alt="${p.title}"
          class="admin-position-thumb"
        />

        <div class="admin-position-fields">
          <label>Tên mục (VD: Ban Hoạt Động)</label>
          <input type="text" class="input-title" value="${escapeHtml(p.title)}" />

          <label>Giới thiệu ngắn (hiện ở khung chi tiết trang công khai khi bấm vào mục này)</label>
          <textarea class="input-description" rows="3" placeholder="VD: Đội Chỉ Huy là bộ phận điều hành chung, chịu trách nhiệm...">${escapeHtml(p.description || "")}</textarea>

          <label>Mục cha (cấp trên trong sơ đồ cây)</label>
          <select
            class="input-parent js-parent-select"
            data-current-parent-id="${p.parent_id || ""}"
            data-exclude-id="${p.id}"
          ></select>

          <label>Cấp bậc</label>
          <select class="input-level js-level-select" data-current-level-id="${p.level_id || ""}"></select>
        </div>

        <div class="admin-position-actions">
          <button class="btn btn-primary btn-save-position">💾 Lưu</button>
          <button class="btn btn-danger btn-delete-position">🗑️ Xóa</button>
        </div>
      </div>

      <div class="admin-position-leaders-section">
        <button type="button" class="btn-toggle-leaders" data-position-id="${p.id}">
          👥 Quản lý chỉ huy (<span class="leaders-count" data-count-for="${p.id}">${leaderCount}</span>)
        </button>
        <div class="leaders-panel" id="leadersPanel-${p.id}" hidden></div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text).replace(/"/g, "&quot;");
}

/* =======================================================
   TẠO MỚI 1 MỤC (Create)
   ======================================================= */
function initAddForm() {
  const form = document.getElementById("addPositionForm");
  const messageEl = document.getElementById("addMessage");
  const addBtn = document.getElementById("addBtn");
  const levelSelect = document.getElementById("newLevel");
  levelSelect.classList.add("js-level-select");

  const parentSelect = document.getElementById("newParentId");
  parentSelect.classList.add("js-parent-select");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("newTitle").value.trim();
    const levelId = levelSelect.value || null;
    const parentId = parentSelect.value || null;

    if (!title) return;

    addBtn.disabled = true;
    addBtn.textContent = "Đang thêm...";
    messageEl.hidden = true;

    const siblingItems = allLoadedPositions.filter((p) => (p.parent_id || null) == parentId);
    const maxOrder = siblingItems.reduce((max, p) => Math.max(max, p.display_order || 0), 0);

    const { error: insertError } = await supabaseClient.from("org_positions").insert({
      title,
      level_id: levelId,
      parent_id: parentId,
      display_order: maxOrder + 1,
    });

    addBtn.disabled = false;
    addBtn.textContent = "+ Thêm chức vụ";

    if (insertError) {
      showMessage(messageEl, `Lỗi lưu dữ liệu: ${insertError.message}`, true);
      return;
    }

    showMessage(
      messageEl,
      "✅ Đã thêm mục mới thành công! Bấm vào dòng vừa thêm để nhập \"Giới thiệu ngắn\", hoặc bấm \"Quản lý chỉ huy\" để thêm người.",
      false
    );
    form.reset();
    loadPositions();
  });
}

/* =======================================================
   CẬP NHẬT + XÓA + SẮP XẾP 1 MỤC
   ======================================================= */
function attachRowEvents() {
  document.querySelectorAll(".admin-level-group-items").forEach((groupEl) => {
    const rows = Array.from(groupEl.querySelectorAll(".admin-position-row"));

    rows.forEach((row, index) => {
      const upBtn = row.querySelector(".btn-position-up");
      const downBtn = row.querySelector(".btn-position-down");

      upBtn.addEventListener("click", () => swapPositionOrder(rows, index, index - 1));
      downBtn.addEventListener("click", () => swapPositionOrder(rows, index, index + 1));
    });
  });

  document.querySelectorAll(".btn-save-position").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".admin-position-row");
      const id = row.dataset.id;

      const title = row.querySelector(".input-title").value.trim();
      // MỚI: đọc giá trị ô "Giới thiệu ngắn" của mục để lưu cùng lúc
      const description = row.querySelector(".input-description").value.trim();
      const levelId = row.querySelector(".input-level").value || null;
      const parentId = row.querySelector(".input-parent").value || null;

      btn.disabled = true;
      btn.textContent = "Đang lưu...";

      const updates = { title, description, level_id: levelId, parent_id: parentId };

      const { error } = await supabaseClient.from("org_positions").update(updates).eq("id", id);

      btn.disabled = false;
      btn.textContent = "💾 Lưu";

      if (error) {
        alert("Lỗi cập nhật: " + error.message);
        return;
      }

      loadPositions();
    });
  });

  document.querySelectorAll(".btn-delete-position").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".admin-position-row");
      const id = row.dataset.id;
      const title = row.querySelector(".input-title").value;

      const confirmed = confirm(
        `Bạn có chắc muốn xóa mục "${title}"? Toàn bộ chỉ huy thuộc mục này cũng sẽ bị xóa theo.`
      );
      if (!confirmed) return;

      const { error } = await supabaseClient.from("org_positions").delete().eq("id", id);

      if (error) {
        alert("Lỗi xóa: " + error.message);
        return;
      }

      loadPositions();
    });
  });
}

async function swapPositionOrder(rows, indexA, indexB) {
  if (indexB < 0 || indexB >= rows.length) return;

  const idA = rows[indexA].dataset.id;
  const idB = rows[indexB].dataset.id;

  const posA = allLoadedPositions.find((p) => String(p.id) === String(idA));
  const posB = allLoadedPositions.find((p) => String(p.id) === String(idB));
  if (!posA || !posB) return;

  const { error } = await supabaseClient
    .from("org_positions")
    .update({ display_order: posB.display_order })
    .eq("id", posA.id);
  if (error) {
    alert("Lỗi đổi thứ tự: " + error.message);
    return;
  }

  await supabaseClient.from("org_positions").update({ display_order: posA.display_order }).eq("id", posB.id);

  loadPositions();
}

/* =======================================================
   PHẦN 3: NHIỀU CHỈ HUY / 1 MỤC (org_position_leaders)
   ======================================================= */

let leaderCountsByPosition = {};

async function loadLeaderCounts() {
  const { data, error } = await supabaseClient.from("org_position_leaders").select("id, position_id");
  if (error) {
    console.error("Lỗi tải số lượng chỉ huy:", error);
    return;
  }
  leaderCountsByPosition = {};
  (data || []).forEach((row) => {
    leaderCountsByPosition[row.position_id] = (leaderCountsByPosition[row.position_id] || 0) + 1;
  });
}

function updateLeaderCountBadge(positionId, delta) {
  const span = document.querySelector(`.leaders-count[data-count-for="${positionId}"]`);
  if (!span) return;
  const current = parseInt(span.textContent, 10) || 0;
  span.textContent = Math.max(0, current + delta);
}

function attachLeadersToggleEvents() {
  document.querySelectorAll(".btn-toggle-leaders").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const positionId = btn.dataset.positionId;
      const panel = document.getElementById(`leadersPanel-${positionId}`);
      if (!panel) return;

      if (!panel.hidden) {
        panel.hidden = true;
        return;
      }

      panel.hidden = false;
      if (!panel.dataset.loaded) {
        panel.innerHTML = '<p class="loading-text">Đang tải...</p>';
        await loadAndRenderLeadersPanel(positionId, panel);
        panel.dataset.loaded = "1";
      }
    });
  });
}

async function loadAndRenderLeadersPanel(positionId, panel) {
  const { data, error } = await supabaseClient
    .from("org_position_leaders")
    .select("*")
    .eq("position_id", positionId)
    .order("display_order", { ascending: true });

  if (error) {
    panel.innerHTML = `<p class="admin-message admin-message-error">Lỗi tải danh sách chỉ huy: ${error.message}</p>`;
    return;
  }

  renderLeadersPanel(positionId, panel, data || []);
}

function renderLeadersPanel(positionId, panel, leaders) {
  panel.innerHTML = `
    <div class="leaders-rows">
      ${
        leaders.length === 0
          ? '<p class="loading-text">Chưa có chỉ huy nào cho mục này. Thêm ở form bên dưới.</p>'
          : leaders.map((l, i) => renderLeaderRowHTML(l, i, leaders.length)).join("")
      }
    </div>
    <form class="admin-form add-leader-form">
      <label>Chức vụ (VD: Đội trưởng)</label>
      <input type="text" class="input-new-leader-title" placeholder="VD: Đội trưởng" />

      <label>Tên chỉ huy</label>
      <input type="text" class="input-new-leader-name" placeholder="VD: Nguyễn Văn A" />

      <label>Giới thiệu ngắn</label>
      <textarea class="input-new-leader-bio" rows="2" placeholder="Vài dòng giới thiệu..."></textarea>

      <label>Ảnh đại diện</label>
      <input type="file" class="input-new-leader-image" accept="image/*" />

      <button type="submit" class="btn btn-primary">+ Thêm chỉ huy</button>
    </form>
  `;

  attachLeaderPanelEvents(positionId, panel);
}

function renderLeaderRowHTML(l, index, total) {
  return `
    <div class="admin-position-row leader-row" data-leader-id="${l.id}">
      <div class="admin-position-order-controls">
        <button type="button" class="btn-leader-up" ${index === 0 ? "disabled" : ""} title="Lên trước">▲</button>
        <button type="button" class="btn-leader-down" ${
          index === total - 1 ? "disabled" : ""
        } title="Xuống sau">▼</button>
      </div>

      <img
        src="${l.image_url || ADMIN_THUMB_PLACEHOLDER}"
        alt="${escapeHtml(l.name || "")}"
        class="admin-position-thumb"
      />

      <div class="admin-position-fields">
        <label>Chức vụ</label>
        <input type="text" class="input-leader-title" value="${escapeHtml(l.title || "")}" />

        <label>Tên</label>
        <input type="text" class="input-leader-name" value="${escapeHtml(l.name || "")}" />

        <label>Giới thiệu ngắn</label>
        <textarea class="input-leader-bio" rows="2">${escapeHtml(l.bio || "")}</textarea>

        <label>Đổi ảnh (không bắt buộc)</label>
        <input type="file" class="input-leader-image" accept="image/*" />
      </div>

      <div class="admin-position-actions">
        <button class="btn btn-primary btn-save-leader">💾 Lưu</button>
        <button class="btn btn-danger btn-delete-leader">🗑️ Xóa</button>
      </div>
    </div>
  `;
}

function attachLeaderPanelEvents(positionId, panel) {
  const rowsWrap = panel.querySelector(".leaders-rows");
  const rows = Array.from(rowsWrap.querySelectorAll(".leader-row"));

  rows.forEach((row, index) => {
    const upBtn = row.querySelector(".btn-leader-up");
    const downBtn = row.querySelector(".btn-leader-down");
    if (upBtn) upBtn.addEventListener("click", () => swapLeaderOrder(positionId, panel, rows, index, index - 1));
    if (downBtn) downBtn.addEventListener("click", () => swapLeaderOrder(positionId, panel, rows, index, index + 1));

    row.querySelector(".btn-save-leader").addEventListener("click", async () => {
      const leaderId = row.dataset.leaderId;
      const title = row.querySelector(".input-leader-title").value.trim();
      const name = row.querySelector(".input-leader-name").value.trim();
      const bio = row.querySelector(".input-leader-bio").value.trim();
      const rawImageFile = row.querySelector(".input-leader-image").files[0];

      let imageFile = undefined;
      if (rawImageFile) {
        const picked = await openImagePicker([rawImageFile]);
        if (picked.length === 0) return;
        imageFile = picked[0];
      }

      const btn = row.querySelector(".btn-save-leader");
      btn.disabled = true;
      btn.textContent = "Đang lưu...";

      const updates = { title, name, bio };
      if (imageFile) {
        const { url, error: uploadError } = await uploadLeaderImage(imageFile);
        if (uploadError) {
          alert("Lỗi upload ảnh: " + uploadError);
          btn.disabled = false;
          btn.textContent = "💾 Lưu";
          return;
        }
        updates.image_url = url;
      }

      const { error } = await supabaseClient.from("org_position_leaders").update(updates).eq("id", leaderId);

      btn.disabled = false;
      btn.textContent = "💾 Lưu";

      if (error) {
        alert("Lỗi cập nhật: " + error.message);
        return;
      }

      await loadAndRenderLeadersPanel(positionId, panel);
    });

    row.querySelector(".btn-delete-leader").addEventListener("click", async () => {
      const leaderId = row.dataset.leaderId;
      const name = row.querySelector(".input-leader-name").value;

      const confirmed = confirm(`Xóa chỉ huy "${name || "(chưa đặt tên)"}"?`);
      if (!confirmed) return;

      const { error } = await supabaseClient.from("org_position_leaders").delete().eq("id", leaderId);
      if (error) {
        alert("Lỗi xóa: " + error.message);
        return;
      }

      updateLeaderCountBadge(positionId, -1);
      await loadAndRenderLeadersPanel(positionId, panel);
    });
  });

  const addForm = panel.querySelector(".add-leader-form");
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = addForm.querySelector(".input-new-leader-title").value.trim();
    const name = addForm.querySelector(".input-new-leader-name").value.trim();
    const bio = addForm.querySelector(".input-new-leader-bio").value.trim();
    const rawImageFile = addForm.querySelector(".input-new-leader-image").files[0];

    let imageFile = undefined;
    if (rawImageFile) {
      const picked = await openImagePicker([rawImageFile]);
      if (picked.length === 0) return;
      imageFile = picked[0];
    }

    const submitBtn = addForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang thêm...";

    let imageUrl = null;
    if (imageFile) {
      const { url, error: uploadError } = await uploadLeaderImage(imageFile);
      if (uploadError) {
        alert("Lỗi upload ảnh: " + uploadError);
        submitBtn.disabled = false;
        submitBtn.textContent = "+ Thêm chỉ huy";
        return;
      }
      imageUrl = url;
    }

    const { data: existing } = await supabaseClient
      .from("org_position_leaders")
      .select("display_order")
      .eq("position_id", positionId);
    const maxOrder = (existing || []).reduce((max, r) => Math.max(max, r.display_order || 0), 0);

    const { error } = await supabaseClient.from("org_position_leaders").insert({
      position_id: positionId,
      title,
      name,
      bio,
      image_url: imageUrl,
      display_order: maxOrder + 1,
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "+ Thêm chỉ huy";

    if (error) {
      alert("Lỗi thêm chỉ huy: " + error.message);
      return;
    }

    addForm.reset();
    updateLeaderCountBadge(positionId, 1);
    await loadAndRenderLeadersPanel(positionId, panel);
  });
}

async function swapLeaderOrder(positionId, panel, rows, indexA, indexB) {
  if (indexB < 0 || indexB >= rows.length) return;

  const idA = rows[indexA].dataset.leaderId;
  const idB = rows[indexB].dataset.leaderId;

  const { data: leaderA } = await supabaseClient
    .from("org_position_leaders")
    .select("display_order")
    .eq("id", idA)
    .single();
  const { data: leaderB } = await supabaseClient
    .from("org_position_leaders")
    .select("display_order")
    .eq("id", idB)
    .single();
  if (!leaderA || !leaderB) return;

  await supabaseClient.from("org_position_leaders").update({ display_order: leaderB.display_order }).eq("id", idA);
  await supabaseClient.from("org_position_leaders").update({ display_order: leaderA.display_order }).eq("id", idB);

  await loadAndRenderLeadersPanel(positionId, panel);
}

/* =======================================================
   HÀM DÙNG CHUNG: Upload ảnh lên Supabase Storage
   ======================================================= */
async function uploadPositionImage(file) {
  const cleanFileName = sanitizeFileName(file.name);
  const filePath = `positions/${Date.now()}_${cleanFileName}`;

  const { error: uploadError } = await supabaseClient.storage.from("org.images").upload(filePath, file);

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabaseClient.storage.from("org.images").getPublicUrl(filePath);

  return { url: data.publicUrl, error: null };
}

// upload ảnh riêng cho từng CHỈ HUY (lưu vào thư mục leaders/)
async function uploadLeaderImage(file) {
  const cleanFileName = sanitizeFileName(file.name);
  const filePath = `leaders/${Date.now()}_${cleanFileName}`;

  const { error: uploadError } = await supabaseClient.storage.from("org.images").upload(filePath, file);

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabaseClient.storage.from("org.images").getPublicUrl(filePath);

  return { url: data.publicUrl, error: null };
}

function sanitizeFileName(fileName) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function showMessage(el, text, isError) {
  el.textContent = text;
  el.hidden = false;
  el.className = isError ? "admin-message admin-message-error" : "admin-message admin-message-success";
}