/* =======================================================
   FILE: admin-events.js
   MỤC ĐÍCH: CRUD cho bảng "events" + xem danh sách người đã
   đăng ký tham gia (bảng "event_registrations", chỉ đọc, vì
   việc đăng ký do người dùng công khai tự thêm ở su-kien.html).

   Bật/tắt đăng ký cho từng sự kiện (registration_enabled)
   Hạn chót đăng ký (registration_deadline)
   Câu hỏi đăng ký tùy chỉnh, bắt buộc trả lời
   (registration_questions)
   Danh sách đăng ký thu gọn 1 dòng/người, có nút "Xem thêm"
   để xem hết câu trả lời của người đó

   MỚI: khối video (upload file hoặc dán link nhúng) trong
   content_blocks — dùng uploadOneEventVideo().

   Cần: supabase-config.js (biến supabaseClient),
        registration-questions-editor.js (initRegQuestionsEditor)
        nạp trước.
   ======================================================= */

let newEventBlocksEditorApi = null;
let newRegQuestionsEditorApi = null;

// Lưu tạm registration_questions của TỪNG sự kiện theo id, để
// khi bấm "Xem danh sách đăng ký" ta biết cách hiển thị câu
// trả lời (câu hỏi nào ứng với id nào) mà không cần hỏi lại DB.
const eventRegQuestionsCache = {};

document.addEventListener("DOMContentLoaded", () => {
  loadEventsAdmin();
  initAddEventForm();

  newEventBlocksEditorApi = initContentBlocksEditor(
    document.getElementById("newContentBlocksEditor"),
    [],
    uploadOneEventImage,
    uploadOneEventVideo
  );

  newRegQuestionsEditorApi = initRegQuestionsEditor(document.getElementById("newRegQuestionsEditor"), []);

  // Bật/tắt hiển thị khung "hạn chót + câu hỏi" theo checkbox
  // đăng ký của form TẠO MỚI
  const newRegEnabledCheckbox = document.getElementById("newRegEnabled");
  const newRegOptionsPanel = document.getElementById("newRegistrationOptions");
  newRegEnabledCheckbox.addEventListener("change", () => {
    newRegOptionsPanel.hidden = !newRegEnabledCheckbox.checked;
  });
});

// Hàm upload 1 ảnh — dùng cho Block Editor (khác uploadEventImages
// vốn nhận vào 1 MẢNG file, ở đây Block Editor chỉ cần upload TỪNG ảnh 1)
async function uploadOneEventImage(file) {
  const { urls, error } = await uploadEventImages([file]);
  return { url: urls[0], error };
}

// Hàm upload 1 video — dùng cho Block Editor
async function uploadOneEventVideo(file) {
  const cleanFileName = sanitizeFileName(file.name);
  const filePath = `events-videos/${Date.now()}_${cleanFileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("events.images")
    .upload(filePath, file);

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabaseClient.storage.from("events.images").getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

/* =======================================================
   ĐỌC DỮ LIỆU (Read)
   ======================================================= */
async function loadEventsAdmin() {
  const container = document.getElementById("eventsAdminList");

  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    container.innerHTML = `<p class="admin-message admin-message-error">Lỗi tải dữ liệu: ${error.message}</p>`;
    return;
  }

  renderEventsAdminList(data);
}

function renderEventsAdminList(events) {
  const container = document.getElementById("eventsAdminList");

  if (!events || events.length === 0) {
    container.innerHTML = '<p class="loading-text">Chưa có sự kiện nào. Tạo mới ở form phía trên.</p>';
    return;
  }

  container.innerHTML = events
    .map((ev) => {
      // Lưu lại câu hỏi đăng ký của sự kiện này để dùng khi
      // hiển thị danh sách người đăng ký (xem attachEventRowEvents)
      eventRegQuestionsCache[ev.id] = ev.registration_questions || [];

      const regEnabled = ev.registration_enabled !== false; // mặc định true nếu chưa có dữ liệu cũ

      return `
      <div class="admin-position-row admin-event-row" data-id="${ev.id}" data-content-blocks="${encodeBlocksForAttr(ev.content_blocks)}">
        <div class="admin-multi-thumb-col">
          ${renderThumbGallery(ev.image_urls && ev.image_urls.length > 0 ? ev.image_urls : (ev.image_url ? [ev.image_url] : []), ev.id, "events")}
        </div>

        <div class="admin-position-fields">
          <label>Tên sự kiện</label>
          <input type="text" class="input-title" value="${escapeHtml(ev.title)}" />

          <label>Ngày giờ diễn ra</label>
          <input type="datetime-local" class="input-date" value="${toDatetimeLocalValue(ev.event_date)}" />

          <label>Địa điểm</label>
          <input type="text" class="input-location" value="${escapeHtml(ev.location || "")}" />

          <label>Mô tả</label>
          <textarea class="input-description" rows="2">${escapeHtml(ev.description || "")}</textarea>

          <label>Thêm ảnh mới (không bắt buộc, chọn được nhiều ảnh)</label>
          <input type="file" class="input-image" accept="image/*" multiple />

          <label>Nội dung chi tiết (thêm từng khối chữ/ảnh/video, dùng ▲▼ để sắp xếp thứ tự)</label>
          <div class="content-blocks-editor">
            <div class="content-blocks-list"></div>
            <div class="content-blocks-toolbar">
              <button type="button" class="btn btn-outline-dark btn-add-text-block">+ Thêm khối chữ</button>
              <label class="btn btn-outline-dark btn-add-image-block-label">
                + Thêm khối ảnh
                <input type="file" accept="image/*" multiple class="btn-add-image-block-input" hidden />
              </label>
              <label class="btn btn-outline-dark btn-add-image-block-label">
                + Tải video lên
                <input type="file" accept="video/*" multiple class="btn-add-video-upload-input" hidden />
              </label>
              <button type="button" class="btn btn-outline-dark btn-add-video-embed">+ Dán link video</button>
            </div>
          </div>

          <!-- ================= CÀI ĐẶT ĐĂNG KÝ ================= -->
          <div class="registration-settings">
            <label class="admin-checkbox-label">
              <input type="checkbox" class="input-reg-enabled" ${regEnabled ? "checked" : ""} />
              Cho phép đăng ký tham gia sự kiện này
            </label>

            <div class="registration-options-panel" ${regEnabled ? "" : "hidden"}>
              <label>Hạn chót đăng ký (không bắt buộc — để trống nếu không giới hạn)</label>
              <input type="datetime-local" class="input-reg-deadline" value="${toDatetimeLocalValueOrEmpty(ev.registration_deadline)}" />

              <label>Câu hỏi đăng ký thêm (bắt buộc người đăng ký phải trả lời)</label>
              <div class="reg-questions-editor">
                <div class="reg-questions-list"></div>
                <button type="button" class="btn btn-outline-dark btn-add-question">+ Thêm câu hỏi</button>
              </div>
            </div>

            <!-- Nút xem danh sách người đăng ký — bấm mới tải, tránh
                 gọi database cho MỌI sự kiện ngay khi vào trang (lãng phí) -->
            <button type="button" class="btn-toggle-registrations" data-event-id="${ev.id}">
              👥 Xem danh sách đăng ký
            </button>
            <div class="registrations-list" id="regList-${ev.id}" hidden></div>
          </div>
        </div>

        <div class="admin-position-actions">
          <button class="btn btn-primary btn-save-event">💾 Lưu</button>
          <button class="btn btn-danger btn-delete-event">🗑️ Xóa</button>
        </div>
      </div>
    `;
    })
    .join("");

  attachEventRowEvents(events);
}

function escapeHtml(text) {
  return String(text).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Vẽ dãy ảnh nhỏ (thumbnail) hiện có, mỗi ảnh có nút ✕ để xóa RIÊNG
// ảnh đó. "tableName" (VD: "events") giúp hàm xóa biết gọi update
// bảng nào — dùng chung được cho cả events và achievements.
function renderThumbGallery(images, itemId, tableName) {
  if (!images || images.length === 0) {
    return `<div class="admin-no-image">Chưa có ảnh</div>`;
  }

  return `
    <div class="admin-thumb-gallery" data-item-id="${itemId}" data-table="${tableName}">
      ${images
        .map(
          (url, index) => `
        <div class="admin-thumb-item">
          <img src="${url}" alt="Ảnh ${index + 1}" />
          <button type="button" class="btn-remove-thumb" data-url="${String(url).replace(/"/g, "&quot;")}" title="Xóa ảnh này">✕</button>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// Chuyển timestamp Supabase (VD: "2026-08-15T09:00:00+00:00") sang
// định dạng ô <input type="datetime-local"> cần (VD: "2026-08-15T09:00")
function toDatetimeLocalValue(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Giống toDatetimeLocalValue nhưng an toàn với giá trị null/rỗng
// (dùng cho registration_deadline, vốn KHÔNG bắt buộc phải có)
function toDatetimeLocalValueOrEmpty(isoString) {
  if (!isoString) return "";
  return toDatetimeLocalValue(isoString);
}

// Chuyển giá trị input datetime-local (giờ theo múi giờ trình duyệt,
// KHÔNG có offset) sang chuỗi ISO UTC chuẩn để lưu đúng vào Supabase
// (cột timestamptz). Nếu không làm bước này, Postgres sẽ hiểu nhầm
// chuỗi input là giờ UTC thay vì giờ địa phương -> giờ bị lệch múi giờ
// mỗi lần lưu/tải lại.
function localDatetimeInputToISOString(localValue) {
  return new Date(localValue).toISOString();
}

// Giống localDatetimeInputToISOString nhưng trả về null nếu ô
// trống (dùng cho registration_deadline không bắt buộc)
function localDatetimeInputToISOStringOrNull(localValue) {
  if (!localValue) return null;
  return localDatetimeInputToISOString(localValue);
}

/* =======================================================
   TẠO MỚI (Create)
   ======================================================= */
function initAddEventForm() {
  const form = document.getElementById("addEventForm");
  const messageEl = document.getElementById("addMessage");
  const addBtn = document.getElementById("addBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("newTitle").value.trim();
    const eventDateRaw = document.getElementById("newDate").value; // dạng "2026-08-15T09:00"
    const eventDate = eventDateRaw ? localDatetimeInputToISOString(eventDateRaw) : "";
    const location = document.getElementById("newLocation").value.trim();
    const description = document.getElementById("newDescription").value.trim();
    const rawImageFiles = Array.from(document.getElementById("newImage").files);

    const registrationEnabled = document.getElementById("newRegEnabled").checked;
    const regDeadlineRaw = document.getElementById("newRegDeadline").value;
    const registrationDeadline = registrationEnabled ? localDatetimeInputToISOStringOrNull(regDeadlineRaw) : null;
    const registrationQuestions = registrationEnabled ? newRegQuestionsEditorApi.getQuestions() : [];

    if (!title || !eventDate) return;

    // Nếu có chọn ảnh, mở khung sắp xếp thứ tự + cắt/căn chỉnh từng ảnh
    // trước khi thật sự upload (đúng thứ tự đã sắp xếp trong khung này)
    let imageFiles = [];
    if (rawImageFiles.length > 0) {
      imageFiles = await openImagePicker(rawImageFiles);
      if (imageFiles.length === 0) return; // hủy ở bước sắp xếp/căn chỉnh -> không tạo sự kiện
    }

    addBtn.disabled = true;
    addBtn.textContent = "Đang tạo...";
    messageEl.hidden = true;

    let imageUrls = [];
    if (imageFiles.length > 0) {
      const { urls, error: uploadError } = await uploadEventImages(imageFiles);
      if (uploadError) {
        showMessage(messageEl, `Lỗi upload ảnh: ${uploadError}`, true);
        addBtn.disabled = false;
        addBtn.textContent = "+ Tạo sự kiện";
        return;
      }
      imageUrls = urls;
    }

    // Lấy nội dung chi tiết dạng khối (chữ + ảnh + video, đúng thứ tự đã sắp
    // xếp bằng ▲▼); ảnh/video nào trong khối chưa upload sẽ được upload ở đây
    let contentBlocks = [];
    try {
      contentBlocks = await newEventBlocksEditorApi.getBlocksForSave();
    } catch (blocksError) {
      showMessage(messageEl, `Lỗi upload trong nội dung chi tiết: ${blocksError.message}`, true);
      addBtn.disabled = false;
      addBtn.textContent = "+ Tạo sự kiện";
      return;
    }

    const { error: insertError } = await supabaseClient.from("events").insert({
      title,
      event_date: eventDate,
      location,
      description,
      image_urls: imageUrls,
      image_url: imageUrls[0] || null,
      content_blocks: contentBlocks,
      registration_enabled: registrationEnabled,
      registration_deadline: registrationDeadline,
      registration_questions: registrationQuestions,
    });

    addBtn.disabled = false;
    addBtn.textContent = "+ Tạo sự kiện";

    if (insertError) {
      showMessage(messageEl, `Lỗi lưu dữ liệu: ${insertError.message}`, true);
      return;
    }

    showMessage(messageEl, "✅ Đã tạo sự kiện thành công!", false);
    form.reset();
    newEventBlocksEditorApi.reset();
    newRegQuestionsEditorApi.reset();
    document.getElementById("newRegistrationOptions").hidden = !document.getElementById("newRegEnabled").checked;
    loadEventsAdmin();
  });
}

/* =======================================================
   CẬP NHẬT (Update) + XÓA (Delete) + XEM ĐĂNG KÝ
   ======================================================= */
function attachEventRowEvents(events) {
  document.querySelectorAll(".admin-event-row").forEach((row) => {
    const id = row.dataset.id;
    const ev = events.find((item) => String(item.id) === String(id));

    const editorEl = row.querySelector(".content-blocks-editor");
    if (editorEl) {
      const initialBlocks = decodeBlocksFromAttr(row.dataset.contentBlocks);
      initContentBlocksEditor(editorEl, initialBlocks, uploadOneEventImage, uploadOneEventVideo);
    }

    // Khung câu hỏi đăng ký của DÒNG này — gắn API vào chính
    // phần tử row để lúc "Lưu" lấy lại được dễ dàng
    const regQuestionsEditorEl = row.querySelector(".reg-questions-editor");
    if (regQuestionsEditorEl) {
      row._regQuestionsApi = initRegQuestionsEditor(regQuestionsEditorEl, (ev && ev.registration_questions) || []);
    }

    // Bật/tắt hiển thị khung "hạn chót + câu hỏi" theo checkbox
    // đăng ký của DÒNG này
    const regEnabledCheckbox = row.querySelector(".input-reg-enabled");
    const regOptionsPanel = row.querySelector(".registration-options-panel");
    regEnabledCheckbox.addEventListener("change", () => {
      regOptionsPanel.hidden = !regEnabledCheckbox.checked;
    });
  });

  // "Lưu"
  document.querySelectorAll(".btn-save-event").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".admin-event-row");
      const id = row.dataset.id;

      const title = row.querySelector(".input-title").value.trim();
      const eventDateRaw = row.querySelector(".input-date").value;
      const eventDate = eventDateRaw ? localDatetimeInputToISOString(eventDateRaw) : "";
      const location = row.querySelector(".input-location").value.trim();
      const description = row.querySelector(".input-description").value.trim();
      const rawNewFiles = Array.from(row.querySelector(".input-image").files);

      const registrationEnabled = row.querySelector(".input-reg-enabled").checked;
      const regDeadlineRaw = row.querySelector(".input-reg-deadline").value;
      const registrationDeadline = registrationEnabled ? localDatetimeInputToISOStringOrNull(regDeadlineRaw) : null;
      const registrationQuestions = registrationEnabled && row._regQuestionsApi ? row._regQuestionsApi.getQuestions() : [];

      // Nếu có chọn ảnh mới, mở khung sắp xếp thứ tự + cắt/căn chỉnh trước khi upload
      let newFiles = [];
      if (rawNewFiles.length > 0) {
        newFiles = await openImagePicker(rawNewFiles);
        if (newFiles.length === 0) return; // hủy ở bước sắp xếp/căn chỉnh -> không lưu
      }

      btn.disabled = true;
      btn.textContent = "Đang lưu...";

      const updates = {
        title,
        event_date: eventDate,
        location,
        description,
        registration_enabled: registrationEnabled,
        registration_deadline: registrationDeadline,
        registration_questions: registrationQuestions,
      };

      const blocksEditorEl = row.querySelector(".content-blocks-editor");
      try {
        updates.content_blocks = await blocksEditorEl._blocksApi.getBlocksForSave();
      } catch (blocksError) {
        alert("Lỗi upload trong nội dung chi tiết: " + blocksError.message);
        btn.disabled = false;
        btn.textContent = "💾 Lưu";
        return;
      }

      if (newFiles.length > 0) {
        const { urls, error: uploadError } = await uploadEventImages(newFiles);
        if (uploadError) {
          alert("Lỗi upload ảnh: " + uploadError);
          btn.disabled = false;
          btn.textContent = "💾 Lưu";
          return;
        }

        const { data: current } = await supabaseClient
          .from("events")
          .select("image_urls")
          .eq("id", id)
          .single();

        const existingImages = (current && current.image_urls) || [];
        const combinedImages = [...existingImages, ...urls];

        updates.image_urls = combinedImages;
        updates.image_url = combinedImages[0] || null;
      }

      const { error } = await supabaseClient.from("events").update(updates).eq("id", id);

      btn.disabled = false;
      btn.textContent = "💾 Lưu";

      if (error) {
        alert("Lỗi cập nhật: " + error.message);
        return;
      }

      loadEventsAdmin();
    });
  });

  // "Xóa" — nhắc rõ việc xóa sự kiện sẽ xóa LUÔN toàn bộ danh sách đăng ký liên quan
  // (vì bảng event_registrations có "on delete cascade" trỏ tới events)
  document.querySelectorAll(".btn-delete-event").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".admin-event-row");
      const id = row.dataset.id;
      const title = row.querySelector(".input-title").value;

      const confirmed = confirm(
        `Xóa sự kiện "${title}"? Toàn bộ danh sách đăng ký của sự kiện này cũng sẽ bị xóa theo.`
      );
      if (!confirmed) return;

      const { error } = await supabaseClient.from("events").delete().eq("id", id);

      if (error) {
        alert("Lỗi xóa: " + error.message);
        return;
      }

      loadEventsAdmin();
    });
  });

  // "Xem danh sách đăng ký" — bấm mới tải (tiết kiệm số lần gọi database)
  document.querySelectorAll(".btn-toggle-registrations").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const eventId = btn.dataset.eventId;
      const listEl = document.getElementById(`regList-${eventId}`);

      // Nếu đang MỞ → bấm lần nữa để ĐÓNG lại, không cần tải lại dữ liệu
      if (!listEl.hidden) {
        listEl.hidden = true;
        btn.textContent = "👥 Xem danh sách đăng ký";
        return;
      }

      btn.textContent = "Đang tải...";

      const { data, error } = await supabaseClient
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error) {
        listEl.innerHTML = `<p class="admin-message admin-message-error">Lỗi: ${error.message}</p>`;
      } else if (!data || data.length === 0) {
        listEl.innerHTML = '<p class="loading-text">Chưa có ai đăng ký.</p>';
      } else {
        const questions = eventRegQuestionsCache[eventId] || [];
        listEl.innerHTML = renderRegistrationsList(data, questions);
        attachRegistrationsListEvents(listEl);
      }

      listEl.hidden = false;
      btn.textContent = "👥 Ẩn danh sách đăng ký";
    });
  });

  // "✕" trên từng ảnh nhỏ — xóa RIÊNG 1 ảnh khỏi mảng
  document.querySelectorAll(".btn-remove-thumb").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const galleryEl = btn.closest(".admin-thumb-gallery");
      const itemId = galleryEl.dataset.itemId;
      const urlToRemove = btn.dataset.url;

      const confirmed = confirm("Xóa ảnh này khỏi sự kiện?");
      if (!confirmed) return;

      const { data: current } = await supabaseClient
        .from("events")
        .select("image_urls")
        .eq("id", itemId)
        .single();

      const remainingImages = (current.image_urls || []).filter((url) => url !== urlToRemove);

      await supabaseClient
        .from("events")
        .update({ image_urls: remainingImages, image_url: remainingImages[0] || null })
        .eq("id", itemId);

      loadEventsAdmin();
    });
  });
}

/* =======================================================
   DANH SÁCH ĐĂNG KÝ — thu gọn 1 dòng/người + nút "Xem thêm"
   ======================================================= */

// Vẽ HTML cho toàn bộ danh sách người đăng ký của 1 sự kiện.
// Mỗi người 1 dòng gọn (tên, email, sđt, ngày đăng ký), bấm
// "Xem thêm" mới xổ ra toàn bộ câu trả lời cho câu hỏi tùy chỉnh.
function renderRegistrationsList(registrations, questions) {
  const rowsHtml = registrations
    .map((r) => {
      const answers = r.answers || {};
      const hasCustomAnswers = questions.length > 0;

      return `
        <div class="registration-row" data-reg-id="${r.id}">
          <div class="registration-row-summary">
            <span class="reg-summary-name">${escapeHtml(r.full_name)}</span>
            <span class="reg-summary-contact">${escapeHtml(r.email || "(không có email)")}${
        r.phone ? " · " + escapeHtml(r.phone) : ""
      }</span>
            <span class="reg-summary-date">${formatShortDateTime(r.created_at)}</span>
            ${
              hasCustomAnswers
                ? `<button type="button" class="btn-view-more-reg" data-reg-id="${r.id}">Xem thêm</button>`
                : ""
            }
            <button type="button" class="btn-delete-registration" data-reg-id="${r.id}" title="Xóa lượt đăng ký này">🗑️</button>
          </div>

          ${
            hasCustomAnswers
              ? `
            <div class="registration-details" id="regDetails-${r.id}" hidden>
              ${questions
                .map(
                  (q) => `
                <p class="registration-detail-item">
                  <strong>${escapeHtml(q.text)}:</strong>
                  ${escapeHtml(answers[q.id] || "(không trả lời)")}
                </p>
              `
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    ${rowsHtml}
    <p class="admin-hint">Tổng: ${registrations.length} người đăng ký</p>
  `;
}

// Gắn sự kiện cho nút "Xem thêm" và nút "Xóa" của TỪNG dòng
// đăng ký (gọi lại mỗi lần renderRegistrationsList vẽ ra HTML mới)
function attachRegistrationsListEvents(listEl) {
  listEl.querySelectorAll(".btn-view-more-reg").forEach((viewBtn) => {
    viewBtn.addEventListener("click", () => {
      const regId = viewBtn.dataset.regId;
      const detailsEl = document.getElementById(`regDetails-${regId}`);
      if (!detailsEl) return;

      detailsEl.hidden = !detailsEl.hidden;
      viewBtn.textContent = detailsEl.hidden ? "Xem thêm" : "Thu gọn";
    });
  });

  listEl.querySelectorAll(".btn-delete-registration").forEach((delBtn) => {
    delBtn.addEventListener("click", async () => {
      const regId = delBtn.dataset.regId;
      const confirmed = confirm("Xóa lượt đăng ký này?");
      if (!confirmed) return;

      await supabaseClient.from("event_registrations").delete().eq("id", regId);
      delBtn.closest(".registration-row").remove(); // Xóa luôn dòng đó, không cần tải lại cả danh sách
    });
  });
}

// Định dạng ngày giờ ngắn gọn kiểu Việt Nam cho thời điểm đăng ký
function formatShortDateTime(isoString) {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString("vi-VN");
  const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${timeStr} ${dateStr}`;
}

/* =======================================================
   HÀM DÙNG CHUNG: Upload ảnh sự kiện lên Supabase Storage
   ======================================================= */
async function uploadEventImages(files) {
  const urls = [];

  for (const file of files) {
    const cleanFileName = sanitizeFileName(file.name);
    const filePath = `events/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabaseClient.storage.from("events.images").upload(filePath, file);

    if (uploadError) {
      return { urls: [], error: uploadError.message };
    }

    const { data } = supabaseClient.storage.from("events.images").getPublicUrl(filePath);
    urls.push(data.publicUrl);
  }

  return { urls, error: null };
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