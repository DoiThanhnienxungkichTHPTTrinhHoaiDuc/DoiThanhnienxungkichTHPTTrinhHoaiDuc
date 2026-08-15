/* =======================================================
   FILE: admin-stats.js
   MỤC ĐÍCH:
   1. Đếm số liệu tổng quan (thành viên, tin tức, sự kiện,
      lượt đăng ký, ảnh) — dùng { count: "exact", head: true }
      để CHỈ đếm số lượng, KHÔNG tải toàn bộ dữ liệu về (nhanh
      hơn nhiều so với .select("*") rồi đếm .length).
   2. CRUD danh sách thành viên (bảng members).
   3. CRUD thư viện ảnh (bảng gallery_images + bucket gallery.images)
      — hỗ trợ TẢI NHIỀU ẢNH cùng lúc và XÓA NHIỀU ẢNH cùng lúc.

   Cần: supabase-config.js (biến supabaseClient) nạp trước.
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadMembers();
  initAddMemberForm();
  loadGalleryAdmin();
  initAddGalleryForm();
});

/* =======================================================
   PHẦN 1: SỐ LIỆU TỔNG QUAN
   ======================================================= */
async function loadStats() {
  // Chạy CẢ 5 câu đếm CÙNG LÚC bằng Promise.all, thay vì đếm
  // lần lượt từng cái — giúp trang tải nhanh hơn nhiều lần,
  // vì không phải chờ câu này xong mới chạy câu tiếp theo.
  const [members, news, events, registrations, gallery] = await Promise.all([
    countRows("members"),
    countRows("news_posts"),
    countRows("events"),
    countRows("event_registrations"),
    countRows("gallery_images"),
  ]);

  document.getElementById("statMembers").textContent = members;
  document.getElementById("statNews").textContent = news;
  document.getElementById("statEvents").textContent = events;
  document.getElementById("statRegistrations").textContent = registrations;
  document.getElementById("statGallery").textContent = gallery;
}

// Hàm dùng chung: đếm số dòng trong 1 bảng bất kỳ
async function countRows(tableName) {
  // { count: "exact", head: true }: yêu cầu Supabase chỉ trả về
  // CON SỐ tổng số dòng, KHÔNG trả về dữ liệu thật — tiết kiệm
  // băng thông đáng kể so với lấy hết dữ liệu rồi đếm .length
  const { count, error } = await supabaseClient
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(`Lỗi đếm bảng ${tableName}:`, error);
    return "?"; // Hiện dấu hỏi thay vì làm hỏng cả trang nếu 1 bảng bị lỗi
  }

  return count;
}

/* =======================================================
   PHẦN 2: QUẢN LÝ THÀNH VIÊN
   (Giữ nguyên 100% so với bản cũ, không đổi gì ở đây)
   ======================================================= */
async function loadMembers() {
  const container = document.getElementById("membersList");

  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = `<p class="admin-message admin-message-error">Lỗi tải dữ liệu: ${error.message}</p>`;
    return;
  }

  renderMembersList(data);
}

function renderMembersList(members) {
  const container = document.getElementById("membersList");

  if (!members || members.length === 0) {
    container.innerHTML = '<p class="loading-text">Chưa có thành viên nào.</p>';
    return;
  }

  container.innerHTML = `
    <table class="registrations-table">
      <thead>
        <tr><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Ngày tham gia</th><th></th></tr>
      </thead>
      <tbody>
        ${members
          .map(
            (m) => `
          <tr>
            <td>${escapeHtml(m.full_name)}</td>
            <td>${escapeHtml(m.email || "")}</td>
            <td>${escapeHtml(m.phone || "")}</td>
            <td>${m.join_date ? new Date(m.join_date).toLocaleDateString("vi-VN") : ""}</td>
            <td><button class="btn-delete-member" data-id="${m.id}">🗑️</button></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll(".btn-delete-member").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = confirm("Xóa thành viên này khỏi danh sách?");
      if (!confirmed) return;

      await supabaseClient.from("members").delete().eq("id", btn.dataset.id);
      loadMembers(); // Tải lại danh sách
      loadStats(); // Cập nhật lại số đếm ở phần Số liệu tổng quan
    });
  });
}

function initAddMemberForm() {
  const form = document.getElementById("addMemberForm");
  const messageEl = document.getElementById("addMemberMessage");
  const btn = document.getElementById("addMemberBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const full_name = document.getElementById("newMemberName").value.trim();
    const email = document.getElementById("newMemberEmail").value.trim();
    const phone = document.getElementById("newMemberPhone").value.trim();

    if (!full_name) return;

    btn.disabled = true;
    btn.textContent = "Đang thêm...";

    const { error } = await supabaseClient.from("members").insert({ full_name, email, phone });

    btn.disabled = false;
    btn.textContent = "+ Thêm thành viên";

    if (error) {
      showMessage(messageEl, `Lỗi: ${error.message}`, true);
      return;
    }

    showMessage(messageEl, "✅ Đã thêm thành viên!", false);
    form.reset();
    loadMembers();
    loadStats(); // Số đếm thành viên tăng lên ngay, không cần tải lại trang
  });
}

/* =======================================================
   PHẦN 3: QUẢN LÝ THƯ VIỆN ẢNH
   (PHẦN NÀY ĐÃ CẬP NHẬT: tải nhiều ảnh + xóa nhiều ảnh)
   ======================================================= */

// Lưu danh sách id ảnh đang được TÍCH CHỌN để xóa hàng loạt.
// Dùng Set để thêm/bỏ/kiểm tra rất nhanh và không bị trùng id.
const selectedGalleryIds = new Set();

async function loadGalleryAdmin() {
  const container = document.getElementById("galleryAdminGrid");

  // Mỗi lần tải lại danh sách ảnh (sau khi thêm/xóa), xóa sạch
  // các lựa chọn cũ để tránh xóa nhầm ảnh không còn hiển thị nữa
  selectedGalleryIds.clear();

  const { data, error } = await supabaseClient
    .from("gallery_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = `<p class="admin-message admin-message-error">Lỗi tải dữ liệu: ${error.message}</p>`;
    return;
  }

  renderGalleryAdminGrid(data);
  updateGalleryToolbar(data || []);
}

function renderGalleryAdminGrid(images) {
  const container = document.getElementById("galleryAdminGrid");

  if (!images || images.length === 0) {
    container.innerHTML = '<p class="loading-text">Thư viện chưa có ảnh nào.</p>';
    return;
  }

  container.innerHTML = images
    .map(
      (img) => `
      <div class="gallery-admin-item">
        <label class="gallery-admin-checkbox-wrap">
          <input type="checkbox" class="gallery-item-checkbox" data-id="${img.id}" />
        </label>
        <img src="${img.image_url}" alt="${escapeHtml(img.caption || "")}" />
        <p class="gallery-caption">${escapeHtml(img.caption || "(không có chú thích)")}</p>
        <button class="btn btn-danger btn-delete-gallery" data-id="${img.id}">🗑️ Xóa</button>
      </div>
    `
    )
    .join("");

  // Nút xóa TỪNG ảnh riêng lẻ (giữ nguyên chức năng cũ)
  document.querySelectorAll(".btn-delete-gallery").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = confirm("Xóa ảnh này khỏi thư viện?");
      if (!confirmed) return;

      // Lưu ý: chỉ xóa bản ghi trong bảng gallery_images (đường dẫn
      // tới ảnh), KHÔNG xóa file ảnh thật trong Storage — để đơn
      // giản hóa code. File ảnh cũ sẽ vẫn còn trong Storage nhưng
      // không hiển thị ở đâu nữa (không ảnh hưởng tới hoạt động web).
      await supabaseClient.from("gallery_images").delete().eq("id", btn.dataset.id);
      loadGalleryAdmin();
      loadStats();
    });
  });

  // Checkbox TỪNG ảnh — bấm để thêm/bỏ khỏi danh sách chọn xóa hàng loạt
  document.querySelectorAll(".gallery-item-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.id;
      if (checkbox.checked) {
        selectedGalleryIds.add(id);
      } else {
        selectedGalleryIds.delete(id);
      }
      updateGalleryToolbar(images);
    });
  });
}

// Cập nhật thanh công cụ phía trên lưới ảnh: hiện/ẩn, số ảnh đang
// chọn, trạng thái checkbox "Chọn tất cả", và bật/tắt nút xóa
function updateGalleryToolbar(images) {
  const toolbar = document.getElementById("galleryAdminToolbar");
  const selectAllCheckbox = document.getElementById("gallerySelectAllCheckbox");
  const deleteBtn = document.getElementById("btnDeleteSelectedGallery");
  const countEl = document.getElementById("gallerySelectedCount");

  // Không có ảnh nào -> ẩn luôn thanh công cụ
  toolbar.hidden = !images || images.length === 0;
  if (toolbar.hidden) return;

  countEl.textContent = selectedGalleryIds.size;
  deleteBtn.disabled = selectedGalleryIds.size === 0;

  // Checkbox "Chọn tất cả" tự động tích nếu tất cả ảnh đã được chọn
  selectAllCheckbox.checked = images.length > 0 && selectedGalleryIds.size === images.length;
}

function initGalleryBulkToolbar() {
  const selectAllCheckbox = document.getElementById("gallerySelectAllCheckbox");
  const deleteBtn = document.getElementById("btnDeleteSelectedGallery");

  selectAllCheckbox.addEventListener("change", () => {
    const itemCheckboxes = document.querySelectorAll(".gallery-item-checkbox");

    itemCheckboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
      if (selectAllCheckbox.checked) {
        selectedGalleryIds.add(checkbox.dataset.id);
      } else {
        selectedGalleryIds.delete(checkbox.dataset.id);
      }
    });

    updateGalleryToolbar(Array.from(itemCheckboxes).map((c) => ({ id: c.dataset.id })));
  });

  deleteBtn.addEventListener("click", async () => {
    if (selectedGalleryIds.size === 0) return;

    const idsToDelete = Array.from(selectedGalleryIds);
    const confirmed = confirm(`Xóa ${idsToDelete.length} ảnh đã chọn khỏi thư viện?`);
    if (!confirmed) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = "Đang xóa...";

    // Xóa CÙNG LÚC nhiều dòng bằng .in("id", [...]) thay vì lặp
    // từng ảnh gọi .delete() riêng — nhanh hơn và chỉ 1 lần gọi mạng
    const { error } = await supabaseClient.from("gallery_images").delete().in("id", idsToDelete);

    if (error) {
      alert(`Lỗi khi xóa: ${error.message}`);
      deleteBtn.disabled = false;
      deleteBtn.textContent = `🗑️ Xóa đã chọn (${idsToDelete.length})`;
      return;
    }

    loadGalleryAdmin();
    loadStats();
  });
}

function initAddGalleryForm() {
  const form = document.getElementById("addGalleryForm");
  const messageEl = document.getElementById("addGalleryMessage");
  const btn = document.getElementById("addGalleryBtn");

  // Khởi động thanh công cụ "Chọn tất cả / Xóa đã chọn" 1 lần duy
  // nhất khi trang tải xong (các nút này luôn nằm cố định trên
  // trang, chỉ ẩn/hiện chứ không bị xóa đi vẽ lại như lưới ảnh)
  initGalleryBulkToolbar();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Trước đây chỉ lấy files[0] (1 ảnh) -> giờ lấy TOÀN BỘ file
    // đã chọn nhờ input đã thêm thuộc tính "multiple"
    const rawImageFiles = Array.from(document.getElementById("newGalleryImage").files);
    const caption = document.getElementById("newGalleryCaption").value.trim();

    if (rawImageFiles.length === 0) return;

    // Mở khung sắp xếp + cắt/căn chỉnh — ĐÃ HỖ TRỢ SẴN nhiều ảnh,
    // trả về mảng file theo đúng thứ tự người dùng sắp xếp
    const picked = await openImagePicker(rawImageFiles);
    if (picked.length === 0) return; // hủy ở bước căn chỉnh ảnh -> không đăng

    btn.disabled = true;
    messageEl.hidden = true;

    const uploadedRows = [];

    // Tải LẦN LƯỢT từng ảnh lên Storage (không dùng Promise.all để
    // tránh làm nghẽn mạng khi người dùng chọn quá nhiều ảnh cùng lúc,
    // và để hiện được tiến trình "Đang tải ảnh x/y" cho người dùng thấy)
    for (let i = 0; i < picked.length; i++) {
      const imageFile = picked[i];
      btn.textContent = `Đang tải ảnh ${i + 1}/${picked.length}...`;

      const cleanFileName = sanitizeFileName(imageFile.name);
      const filePath = `gallery/${Date.now()}_${i}_${cleanFileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("gallery.images")
        .upload(filePath, imageFile);

      if (uploadError) {
        showMessage(
          messageEl,
          `Lỗi khi tải ảnh ${i + 1}/${picked.length}: ${uploadError.message}. Các ảnh trước đó (nếu có) đã được lưu.`,
          true
        );
        break; // dừng lại, nhưng vẫn lưu những ảnh đã upload thành công trước đó
      }

      const { data: urlData } = supabaseClient.storage.from("gallery.images").getPublicUrl(filePath);

      uploadedRows.push({
        image_url: urlData.publicUrl,
        caption,
        display_order: 0,
      });
    }

    if (uploadedRows.length > 0) {
      // Lưu TẤT CẢ bản ghi ảnh vào database CÙNG 1 LẦN gọi .insert()
      // với mảng object, thay vì gọi insert() lặp lại cho từng ảnh
      const { error: insertError } = await supabaseClient.from("gallery_images").insert(uploadedRows);

      if (insertError) {
        showMessage(messageEl, `Lỗi lưu dữ liệu: ${insertError.message}`, true);
      } else if (uploadedRows.length === picked.length) {
        showMessage(
          messageEl,
          uploadedRows.length === 1 ? "✅ Đã tải ảnh lên thư viện!" : `✅ Đã tải lên ${uploadedRows.length} ảnh vào thư viện!`,
          false
        );
      }
    }

    btn.disabled = false;
    btn.textContent = "+ Tải ảnh lên";
    form.reset();
    loadGalleryAdmin();
    loadStats();
  });
}

/* =======================================================
   HÀM DÙNG CHUNG
   ======================================================= */
function sanitizeFileName(fileName) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function escapeHtml(text) {
  return String(text).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function showMessage(el, text, isError) {
  el.textContent = text;
  el.hidden = false;
  el.className = isError ? "admin-message admin-message-error" : "admin-message admin-message-success";
}