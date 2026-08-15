/* =======================================================
   FILE: content-blocks-editor.js
   MỤC ĐÍCH:
   Bộ soạn "NỘI DUNG THEO KHỐI"
   - Khối chữ
   - Khối ảnh
   - Khối video (tải file lên HOẶC dán link nhúng YouTube/
     Facebook/Google Drive)
   - Sắp xếp ↑ ↓
   - Xóa
   - Chọn nhiều ảnh
   - Cắt/căn chỉnh ảnh
   - Upload ảnh/video khi lưu

   DÙNG CHUNG cho:
   - Tin tức
   - Thành tích
   - Sự kiện
   - Các trang Admin khác

   THAM SỐ MỚI: uploadVideoFn — hàm upload 1 file video, cùng
   chữ ký (file) => { url, error } giống uploadFn (ảnh). Trang
   nào chưa cần khối video thì có thể bỏ trống (undefined),
   nút "Tải video lên" sẽ báo lỗi rõ ràng nếu bị bấm mà thiếu.
   ======================================================= */

function initContentBlocksEditor(editorEl, initialBlocks, uploadFn, uploadVideoFn) {
  const state = {
    blocks: (initialBlocks || []).map((b) => ({ ...b })),
  };

  /* =====================================================
     ESCAPE HTML
     ===================================================== */
  function escapeHtmlLocal(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* =====================================================
     CHUYỂN LINK VIDEO NGƯỜI DÙNG DÁN VÀO → LINK NHÚNG (iframe)
     Hỗ trợ: YouTube (watch/youtu.be/shorts), Facebook (video/
     fb.watch), Google Drive (link chia sẻ dạng .../d/ID/view).
     Link không nhận diện được sẽ dùng NGUYÊN VĂN làm src iframe
     (một số nền tảng khác có thể vẫn nhúng được), kèm cảnh báo
     nhỏ trong khung xem trước để admin biết mà tự kiểm tra lại.
     ===================================================== */
  function toEmbedUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.replace(/^www\./, "");

      // YouTube
      if (host === "youtu.be") {
        const id = u.pathname.slice(1);
        return { embedUrl: `https://www.youtube.com/embed/${id}`, recognized: true };
      }
      if (host === "youtube.com" || host === "m.youtube.com") {
        if (u.pathname.startsWith("/shorts/")) {
          const id = u.pathname.split("/")[2];
          return { embedUrl: `https://www.youtube.com/embed/${id}`, recognized: true };
        }
        if (u.pathname.startsWith("/embed/")) {
          return { embedUrl: rawUrl, recognized: true };
        }
        const id = u.searchParams.get("v");
        if (id) return { embedUrl: `https://www.youtube.com/embed/${id}`, recognized: true };
      }

      // Facebook (video thường hoặc link rút gọn fb.watch)
      if (host === "facebook.com" || host === "fb.watch") {
        return {
          embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(rawUrl)}&show_text=false`,
          recognized: true,
        };
      }

      // Google Drive (link chia sẻ dạng .../file/d/ID/view)
      if (host === "drive.google.com") {
        const match = u.pathname.match(/\/d\/([^/]+)/);
        if (match) {
          return { embedUrl: `https://drive.google.com/file/d/${match[1]}/preview`, recognized: true };
        }
      }

      // Không nhận diện được nền tảng — thử dùng nguyên link
      return { embedUrl: rawUrl, recognized: false };
    } catch (e) {
      return { embedUrl: null, recognized: false };
    }
  }

  /* =====================================================
     TẠO HTML CHO TỪNG KHỐI
     ===================================================== */
  function renderBlockItemHTML(block, index, total) {
    const orderControls = `
      <div class="content-block-order-controls">

        <button
          type="button"
          class="btn-block-up"
          data-index="${index}"
          ${index === 0 ? "disabled" : ""}
          title="Di chuyển lên"
        >
          ▲
        </button>

        <span class="content-block-order-num">
          ${index + 1}
        </span>

        <button
          type="button"
          class="btn-block-down"
          data-index="${index}"
          ${index === total - 1 ? "disabled" : ""}
          title="Di chuyển xuống"
        >
          ▼
        </button>

      </div>
    `;

    let body = "";

    /* ================================
       KHỐI CHỮ
       ================================ */
    if (block.type === "text") {
      body = `
        <textarea
          class="content-block-text-input"
          data-index="${index}"
          rows="3"
          placeholder="Nhập nội dung đoạn văn..."
        >${escapeHtmlLocal(block.text || "")}</textarea>
      `;
    }

    /* ================================
       KHỐI ẢNH
       ================================ */
    else if (block.type === "image") {
      const imageUrl = block.url || block.previewUrl || "";

      body = `
        ${
          imageUrl
            ? `
              <img
                src="${escapeHtmlLocal(imageUrl)}"
                class="content-block-image-preview"
                alt="Ảnh nội dung"
              />
            `
            : `
              <div class="content-block-image-empty">
                Không có ảnh
              </div>
            `
        }
      `;
    }

    /* ================================
       KHỐI VIDEO
       ================================ */
    else if (block.type === "video") {
      if (block.source === "file") {
        const videoUrl = block.url || block.previewUrl || "";
        body = videoUrl
          ? `
            <video
              src="${escapeHtmlLocal(videoUrl)}"
              class="content-block-video-preview"
              controls
              preload="metadata"
            ></video>
            <span class="content-block-video-tag">📁 Video tải lên</span>
          `
          : `<div class="content-block-image-empty">Không có video</div>`;
      } else {
        // source === "embed"
        const converted = toEmbedUrl(block.url || "");
        body = `
          <div class="content-block-video-embed-preview">
            ${
              converted.embedUrl
                ? `<iframe src="${escapeHtmlLocal(converted.embedUrl)}" allowfullscreen></iframe>`
                : `<div class="content-block-image-empty">Link không hợp lệ</div>`
            }
          </div>
          <span class="content-block-video-tag">🔗 Link nhúng${converted.recognized ? "" : " (chưa rõ nền tảng, kiểm tra lại xem có hiện được không)"}</span>
          <input
            type="text"
            class="content-block-video-url-input"
            data-index="${index}"
            value="${escapeHtmlLocal(block.url || "")}"
            placeholder="Dán link video (YouTube, Facebook, Google Drive...)"
          />
        `;
      }
    }

    return `
      <div
        class="content-block-item"
        data-index="${index}"
        data-type="${block.type}"
      >

        ${orderControls}

        <div class="content-block-body">
          ${body}
        </div>

        <button
          type="button"
          class="btn-block-remove"
          data-index="${index}"
          title="Xóa khối này"
        >
          🗑️
        </button>

      </div>
    `;
  }

  /* =====================================================
     RENDER TOÀN BỘ DANH SÁCH
     ===================================================== */
  function renderList() {
    const listEl = editorEl.querySelector(".content-blocks-list");

    if (!listEl) {
      console.error("Không tìm thấy .content-blocks-list trong editor.");
      return;
    }

    if (state.blocks.length === 0) {
      listEl.innerHTML = `
        <p class="content-blocks-empty">
          Chưa có khối nội dung nào.
          Bấm "+ Thêm khối chữ", "+ Thêm khối ảnh" hoặc thêm video bên dưới.
        </p>
      `;
    } else {
      listEl.innerHTML = state.blocks
        .map((block, index) => renderBlockItemHTML(block, index, state.blocks.length))
        .join("");
    }

    attachListEvents();
  }

  /* =====================================================
     GẮN EVENT CHO DANH SÁCH
     ===================================================== */
  function attachListEvents() {
    /* TEXTAREA (khối chữ) */
    editorEl.querySelectorAll(".content-block-text-input").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const index = Number(textarea.dataset.index);
        if (Number.isInteger(index) && state.blocks[index] && state.blocks[index].type === "text") {
          state.blocks[index].text = textarea.value;
        }
      });
    });

    /* Ô nhập link video nhúng — cập nhật lại URL + preview khi gõ xong (blur) */
    editorEl.querySelectorAll(".content-block-video-url-input").forEach((input) => {
      input.addEventListener("change", () => {
        const index = Number(input.dataset.index);
        if (
          Number.isInteger(index) &&
          state.blocks[index] &&
          state.blocks[index].type === "video" &&
          state.blocks[index].source === "embed"
        ) {
          state.blocks[index].url = input.value.trim();
          renderList();
        }
      });
    });

    /* NÚT LÊN */
    editorEl.querySelectorAll(".btn-block-up").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const index = Number(btn.dataset.index);
        if (Number.isInteger(index) && index > 0 && index < state.blocks.length) {
          [state.blocks[index - 1], state.blocks[index]] = [state.blocks[index], state.blocks[index - 1]];
          renderList();
        }
      });
    });

    /* NÚT XUỐNG */
    editorEl.querySelectorAll(".btn-block-down").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const index = Number(btn.dataset.index);
        if (Number.isInteger(index) && index >= 0 && index < state.blocks.length - 1) {
          [state.blocks[index], state.blocks[index + 1]] = [state.blocks[index + 1], state.blocks[index]];
          renderList();
        }
      });
    });

    /* NÚT XÓA */
    editorEl.querySelectorAll(".btn-block-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const index = Number(btn.dataset.index);
        if (Number.isInteger(index) && index >= 0 && index < state.blocks.length) {
          const removedBlock = state.blocks[index];

          /* Thu hồi blob URL nếu là ảnh/video preview */
          if (removedBlock && removedBlock.previewUrl) {
            try {
              URL.revokeObjectURL(removedBlock.previewUrl);
            } catch (error) {
              console.warn("Không thể revoke preview URL:", error);
            }
          }

          state.blocks.splice(index, 1);
          renderList();
        }
      });
    });
  }

  /* =====================================================
     THÊM KHỐI CHỮ
     ===================================================== */
  const addTextButton = editorEl.querySelector(".btn-add-text-block");

  if (addTextButton) {
    addTextButton.addEventListener("click", (e) => {
      e.preventDefault();
      state.blocks.push({ type: "text", text: "" });
      renderList();

      const textareas = editorEl.querySelectorAll(".content-block-text-input");
      const lastTextarea = textareas[textareas.length - 1];
      if (lastTextarea) lastTextarea.focus();
    });
  } else {
    console.error('Không tìm thấy nút ".btn-add-text-block"');
  }

  /* =====================================================
     THÊM KHỐI ẢNH
     ===================================================== */
  const addImageInput = editorEl.querySelector(".btn-add-image-block-input");

  if (addImageInput) {
    addImageInput.addEventListener("change", async (e) => {
      try {
        const rawFiles = Array.from(e.target.files || []);
        e.target.value = "";
        if (rawFiles.length === 0) return;

        const picked = await openImagePicker(rawFiles);
        if (!picked || picked.length === 0) return;

        picked.forEach((file) => {
          state.blocks.push({
            type: "image",
            file: file,
            previewUrl: URL.createObjectURL(file),
          });
        });

        renderList();
      } catch (error) {
        console.error("Lỗi khi thêm khối ảnh:", error);
      }
    });
  } else {
    console.error('Không tìm thấy input ".btn-add-image-block-input"');
  }

  /* =====================================================
     THÊM KHỐI VIDEO — TẢI FILE LÊN
     ===================================================== */
  const addVideoUploadInput = editorEl.querySelector(".btn-add-video-upload-input");

  if (addVideoUploadInput) {
    addVideoUploadInput.addEventListener("change", (e) => {
      const rawFiles = Array.from(e.target.files || []);
      e.target.value = "";
      if (rawFiles.length === 0) return;

      rawFiles.forEach((file) => {
        state.blocks.push({
          type: "video",
          source: "file",
          file: file,
          previewUrl: URL.createObjectURL(file),
        });
      });

      renderList();
    });
  }

  /* =====================================================
     THÊM KHỐI VIDEO — DÁN LINK NHÚNG
     ===================================================== */
  const addVideoEmbedBtn = editorEl.querySelector(".btn-add-video-embed");

  if (addVideoEmbedBtn) {
    addVideoEmbedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const url = window.prompt("Dán link video (YouTube, Facebook, Google Drive...):", "");
      if (!url || !url.trim()) return;

      state.blocks.push({
        type: "video",
        source: "embed",
        url: url.trim(),
      });

      renderList();
    });
  }

  /* =====================================================
     KHỞI TẠO
     ===================================================== */
  renderList();

  /* =====================================================
     API
     ===================================================== */
  const api = {
    async getBlocksForSave() {
      const result = [];

      for (const block of state.blocks) {
        /* KHỐI CHỮ */
        if (block.type === "text") {
          result.push({ type: "text", text: (block.text || "").trim() });
        }

        /* KHỐI ẢNH — đã có URL */
        else if (block.type === "image" && block.url) {
          result.push({ type: "image", url: block.url });
        }

        /* KHỐI ẢNH — mới chọn, cần upload */
        else if (block.type === "image" && block.file) {
          if (typeof uploadFn !== "function") {
            throw new Error("uploadFn (upload ảnh) chưa được truyền vào content blocks editor.");
          }
          const { url, error } = await uploadFn(block.file);
          if (error) throw new Error(error);
          if (!url) throw new Error("Upload ảnh thành công nhưng không nhận được URL.");
          result.push({ type: "image", url: url });
        }

        /* KHỐI VIDEO — link nhúng */
        else if (block.type === "video" && block.source === "embed") {
          const url = (block.url || "").trim();
          if (url) result.push({ type: "video", source: "embed", url: url });
        }

        /* KHỐI VIDEO — đã có URL (đã upload trước đó) */
        else if (block.type === "video" && block.source === "file" && block.url) {
          result.push({ type: "video", source: "file", url: block.url });
        }

        /* KHỐI VIDEO — file mới chọn, cần upload */
        else if (block.type === "video" && block.source === "file" && block.file) {
          if (typeof uploadVideoFn !== "function") {
            throw new Error("uploadVideoFn (upload video) chưa được truyền vào content blocks editor.");
          }
          const { url, error } = await uploadVideoFn(block.file);
          if (error) throw new Error(error);
          if (!url) throw new Error("Upload video thành công nhưng không nhận được URL.");
          result.push({ type: "video", source: "file", url: url });
        }
      }

      return result;
    },

    reset() {
      state.blocks.forEach((block) => {
        if (block.previewUrl) {
          try {
            URL.revokeObjectURL(block.previewUrl);
          } catch (error) {
            console.warn(error);
          }
        }
      });
      state.blocks = [];
      renderList();
    },

    getBlocks() {
      return state.blocks.map((block) => ({ ...block }));
    },
  };

  editorEl._blocksApi = api;

  return api;
}

/* =======================================================
   ENCODE / DECODE BLOCKS — không đổi
   ======================================================= */
function encodeBlocksForAttr(blocks) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(blocks || []))));
}

function decodeBlocksFromAttr(str) {
  if (!str) return [];
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch (e) {
    console.error("Không thể decode content blocks:", e);
    return [];
  }
}