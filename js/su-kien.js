/* =======================================================
   FILE: su-kien.js
   MỤC ĐÍCH: Lấy danh sách sự kiện TỪ SUPABASE (bảng events)
   và hiển thị cho khách xem + đăng ký tham gia (ghi vào bảng
   event_registrations — KHÔNG cần đăng nhập, vì đây là hành
   động công khai, ai cũng đăng ký được).

   CÁC CHỨC NĂNG:
   - Sự kiện có thể TẮT đăng ký (registration_enabled = false)
   - Hạn chót đăng ký (registration_deadline)
   - Câu hỏi đăng ký tùy chỉnh (registration_questions)
   - Hiển thị nội dung chi tiết dạng khối chữ/ảnh
   - Khối chữ + ảnh hiển thị ĐÚNG THỨ TỰ ADMIN ĐÃ SẮP XẾP
   - Phóng to ảnh bằng lightbox
   - Đăng ký sự kiện
   - Sự kiện đã qua giờ diễn ra sẽ KHÔNG hiển thị trên trang
     công khai nữa (lọc ngay khi tải dữ liệu, trước khi vẽ ra)
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  loadEvents();
});


/* =======================================================
   LẤY DANH SÁCH SỰ KIỆN TỪ SUPABASE
   ======================================================= */

async function loadEvents() {
  const container = document.getElementById("eventsList");

  if (!container) return;

  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    container.innerHTML =
      '<p class="loading-text">Không tải được dữ liệu. Vui lòng thử lại sau.</p>';

    console.error("Lỗi tải events:", error);
    return;
  }

  // Chỉ giữ lại sự kiện CHƯA diễn ra (event_date >= thời điểm hiện tại).
  // Sự kiện đã qua giờ diễn ra sẽ không hiển thị trên trang công khai
  // nữa (trang admin vẫn thấy đầy đủ như cũ, không bị ảnh hưởng).
  const upcomingEvents = (data || []).filter(
    (ev) => new Date(ev.event_date) >= new Date()
  );

  renderEvents(upcomingEvents);
}


/* =======================================================
   VẼ DANH SÁCH SỰ KIỆN
   ======================================================= */

function renderEvents(events) {
  const container = document.getElementById("eventsList");

  if (!events || events.length === 0) {
    container.innerHTML =
      '<p class="loading-text">Hiện chưa có sự kiện nào sắp diễn ra.</p>';

    return;
  }

  container.innerHTML = events
    .map((ev) => {

      // Kiểm tra sự kiện đã qua
      const isPast =
        new Date(ev.event_date) < new Date();


      /* ===================================================
         LẤY ẢNH CHÍNH / ẢNH PHỤ CỦA SỰ KIỆN
         =================================================== */

      const images =
        ev.image_urls && ev.image_urls.length > 0
          ? ev.image_urls
          : ev.image_url
          ? [ev.image_url]
          : [];

      const mainImage = images[0];

      const extraImages = images.slice(1);


      return `
        <article class="event-card ${isPast ? "event-card-past" : ""}">

          <div class="event-card-main">

            ${
              mainImage
                ? `
                  <img
                    src="${escapeHtmlPublic(mainImage)}"
                    alt="${escapeHtmlPublic(ev.title)}"
                    class="event-card-img event-card-img-clickable"
                    data-images='${JSON.stringify(images)}'
                    data-index="0"
                    data-caption="${escapeHtmlPublic(ev.title)}"
                  />
                `
                : ""
            }


            <div class="event-card-body">

              <!-- NGÀY GIỜ -->
              <span class="event-card-date">
                📅 ${formatEventDate(ev.event_date)}
              </span>


              <!-- TIÊU ĐỀ -->
              <h3 class="event-card-title">
                ${escapeHtmlPublic(ev.title)}
              </h3>


              <!-- ĐỊA ĐIỂM -->
              ${
                ev.location
                  ? `
                    <p class="event-card-location">
                      📍 ${escapeHtmlPublic(ev.location)}
                    </p>
                  `
                  : ""
              }


              <!-- MÔ TẢ -->
              ${
                ev.description
                  ? `
                    <p class="event-card-desc">
                      ${escapeHtmlPublic(ev.description)}
                    </p>
                  `
                  : ""
              }


              <!-- =========================================
                   ẢNH PHỤ
                   ========================================= -->

              ${
                extraImages.length > 0
                  ? `
                    <div class="event-card-extra-images">

                      ${extraImages
                        .map(
                          (url, i) => `
                            <img
                              src="${escapeHtmlPublic(url)}"
                              alt="${escapeHtmlPublic(ev.title)}"
                              class="event-card-thumb"
                              data-images='${JSON.stringify(images)}'
                              data-index="${i + 1}"
                              data-caption="${escapeHtmlPublic(ev.title)}"
                            />
                          `
                        )
                        .join("")}

                    </div>
                  `
                  : ""
              }


              <!-- =========================================
                   NỘI DUNG CHI TIẾT DẠNG KHỐI

                   Gồm:
                   - type: "text"
                   - type: "image"
                   - type: "video"

                   Giữ nguyên thứ tự từ Admin.
                   ========================================= -->

              ${
                ev.content_blocks &&
                ev.content_blocks.length > 0
                  ? renderEventContentBlocks(
                      ev.content_blocks,
                      ev.title
                    )
                  : ""
              }

            </div>

          </div>


          <!-- =========================================
               CỘT ĐĂNG KÝ
               ========================================= -->

          <div class="event-card-register">
            ${renderRegistrationColumn(ev, isPast)}
          </div>

        </article>
      `;
    })
    .join("");


  attachEventCardEvents();
}


/* =======================================================
   VẼ "NỘI DUNG CHI TIẾT" DẠNG KHỐI

   QUAN TRỌNG:

   content-blocks-editor.js lưu khối chữ dạng:

   {
     type: "text",
     text: "Nội dung..."
   }

   KHÔNG phải:

   {
     type: "text",
     content: "Nội dung..."
   }

   Vì vậy phải đọc:

   block.text

   ======================================================= */

function renderEventContentBlocks(blocks, title) {

  return `
    <div class="event-detail-blocks">

      ${blocks
        .map((block) => {

          /* =============================================
             KHỐI CHỮ
             ============================================= */

          if (block.type === "text") {

            const text = block.text || "";

            // Nếu khối chữ trống thì không hiển thị
            if (!text.trim()) {
              return "";
            }

            return `
              <p class="news-block-text">
                ${escapeHtmlPublic(text).replace(/\n/g, "<br>")}
              </p>
            `;
          }


          /* =============================================
             KHỐI ẢNH
             ============================================= */

          if (
            block.type === "image" &&
            block.url
          ) {

            return `
              <img
                src="${escapeHtmlPublic(block.url)}"
                alt="${escapeHtmlPublic(title)}"
                class="news-block-img event-block-img-clickable"
                data-single-image="${escapeHtmlPublic(block.url)}"
              />
            `;
          }


          /* =============================================
             KHỐI VIDEO

             Gồm:
             - source: "file"  (video tải lên, phát trực tiếp)
             - source: "embed" (link YouTube/Facebook/Drive)
             ============================================= */

          if (block.type === "video" && block.url) {

            if (block.source === "file") {
              return `
                <div class="news-detail-block-video-wrap">
                  <video src="${escapeHtmlPublic(block.url)}" controls preload="metadata"></video>
                </div>
              `;
            }

            const embedUrl = toSuKienEmbedUrl(block.url);

            if (!embedUrl) {
              return "";
            }

            return `
              <div class="news-detail-block-video-wrap">
                <iframe src="${escapeHtmlPublic(embedUrl)}" allowfullscreen></iframe>
              </div>
            `;
          }


          // Nếu block không hợp lệ
          return "";

        })
        .join("")}

    </div>
  `;
}


/* =======================================================
   Chuyển link video người dùng dán vào → link nhúng iframe.
   Cùng logic với content-blocks-editor.js / tin-tuc-chi-tiet.js
   ======================================================= */
function toSuKienEmbedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      }
      if (u.pathname.startsWith("/embed/")) return rawUrl;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "facebook.com" || host === "fb.watch") {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(rawUrl)}&show_text=false`;
    }
    if (host === "drive.google.com") {
      const match = u.pathname.match(/\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return rawUrl;
  } catch (e) {
    return null;
  }
}


/* =======================================================
   CỘT ĐĂNG KÝ
   ======================================================= */

function renderRegistrationColumn(ev, isPast) {

  /* -----------------------------------------------
     SỰ KIỆN ĐÃ QUA
     ----------------------------------------------- */

  if (isPast) {

    return `
      <p class="event-past-label">
        Sự kiện đã diễn ra
      </p>
    `;
  }


  /* -----------------------------------------------
     ADMIN TẮT ĐĂNG KÝ
     ----------------------------------------------- */

  if (ev.registration_enabled === false) {

    return `
      <p class="registration-closed-note">
        Sự kiện này không nhận đăng ký trực tuyến.
      </p>
    `;
  }


  /* -----------------------------------------------
     KIỂM TRA DEADLINE
     ----------------------------------------------- */

  const deadlinePassed =
    ev.registration_deadline &&
    new Date(ev.registration_deadline) < new Date();


  if (deadlinePassed) {

    return `
      <p class="registration-closed-note">
        ⏰ Đã hết hạn đăng ký
        (hạn chót: ${formatEventDate(ev.registration_deadline)}).
      </p>
    `;
  }


  /* -----------------------------------------------
     CÂU HỎI ĐĂNG KÝ
     ----------------------------------------------- */

  const questions =
    ev.registration_questions || [];


  return `

    <button
      type="button"
      class="btn btn-primary btn-toggle-register"
      data-event-id="${ev.id}"
    >
      Đăng ký tham gia
    </button>


    ${
      ev.registration_deadline
        ? `
          <p class="registration-deadline-note">
            ⏳ Hạn chót đăng ký:
            ${formatEventDate(ev.registration_deadline)}
          </p>
        `
        : ""
    }


    <!-- FORM ĐĂNG KÝ -->

    <form
      class="register-form"
      id="registerForm-${ev.id}"
      data-event-id="${ev.id}"
      data-deadline="${ev.registration_deadline || ""}"
      hidden
    >

      <!-- HỌ TÊN -->

      <label>
        Họ và tên
        <span class="required">*</span>
      </label>

      <input
        type="text"
        class="reg-name"
        required
      />


      <!-- EMAIL -->

      <label>
        Email
      </label>

      <input
        type="email"
        class="reg-email"
        required
      />


      <!-- SỐ ĐIỆN THOẠI -->

      <label>
        Số điện thoại
      </label>

      <input
        type="tel"
        class="reg-phone"
        required
      />


      <!-- CÂU HỎI TÙY CHỈNH -->

      ${questions
        .map(
          (q) => `
            <label>
              ${escapeHtmlPublic(q.text)}
              <span class="required">*</span>
            </label>

            <input
              type="text"
              class="reg-answer-input"
              data-question-id="${q.id}"
              required
            />
          `
        )
        .join("")}


      <!-- NÚT GỬI -->

      <button
        type="submit"
        class="btn btn-primary"
      >
        Gửi đăng ký
      </button>

    </form>


    <!-- THÔNG BÁO -->

    <p
      class="register-message"
      id="registerMessage-${ev.id}"
      hidden
    ></p>

  `;
}


/* =======================================================
   ESCAPE HTML AN TOÀN
   ======================================================= */

function escapeHtmlPublic(text) {

  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


/* =======================================================
   KIỂM TRA DEADLINE
   ======================================================= */

function isDeadlinePassed(deadlineStr) {

  if (!deadlineStr) {
    return false;
  }

  return new Date(deadlineStr) < new Date();
}


/* =======================================================
   HIỂN THỊ THÔNG BÁO ĐÃ ĐÓNG ĐĂNG KÝ
   ======================================================= */

function showRegistrationClosed(
  form,
  deadlineStr
) {

  const registerColumnEl =
    form.closest(".event-card-register");

  if (!registerColumnEl) {
    return;
  }


  registerColumnEl.innerHTML = `
    <p class="registration-closed-note">
      ⏰ Đã hết hạn đăng ký
      (hạn chót: ${formatEventDate(deadlineStr)}).
    </p>
  `;
}


/* =======================================================
   ĐỊNH DẠNG NGÀY GIỜ
   ======================================================= */

function formatEventDate(isoString) {

  const d = new Date(isoString);

  const dateStr =
    d.toLocaleDateString("vi-VN");

  const timeStr =
    d.toLocaleTimeString(
      "vi-VN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  return `${timeStr} - ${dateStr}`;
}


/* =======================================================
   GẮN CÁC EVENT CHO THẺ SỰ KIỆN
   ======================================================= */

function attachEventCardEvents() {


  /* =====================================================
     ẢNH CHÍNH + ẢNH PHỤ
     → PHÓNG TO LIGHTBOX
     ===================================================== */

  document
    .querySelectorAll(
      ".event-card-img-clickable, .event-card-thumb"
    )
    .forEach((img) => {

      img.addEventListener("click", () => {

        const images =
          JSON.parse(img.dataset.images);

        const index =
          Number(img.dataset.index);

        openLightbox(
          images,
          index,
          img.dataset.caption
        );

      });

    });


  /* =====================================================
     ẢNH TRONG CONTENT BLOCKS
     → PHÓNG TO RIÊNG
     ===================================================== */

  document
    .querySelectorAll(
      ".event-block-img-clickable"
    )
    .forEach((img) => {

      img.addEventListener("click", () => {

        openLightbox(
          [img.dataset.singleImage],
          0,
          img.alt
        );

      });

    });


  /* =====================================================
     NÚT ĐĂNG KÝ
     ===================================================== */

  document
    .querySelectorAll(
      ".btn-toggle-register"
    )
    .forEach((btn) => {

      btn.addEventListener("click", () => {

        const eventId =
          btn.dataset.eventId;

        const form =
          document.getElementById(
            `registerForm-${eventId}`
          );


        if (!form) {
          return;
        }


        /* ---------------------------------------------
           KIỂM TRA DEADLINE LẠI
           --------------------------------------------- */

        if (
          isDeadlinePassed(
            form.dataset.deadline
          )
        ) {

          showRegistrationClosed(
            form,
            form.dataset.deadline
          );

          return;
        }


        /* ---------------------------------------------
           HIỆN / ẨN FORM
           --------------------------------------------- */

        form.hidden =
          !form.hidden;


        btn.textContent =
          form.hidden
            ? "Đăng ký tham gia"
            : "Ẩn form đăng ký";

      });

    });


  /* =====================================================
     XỬ LÝ SUBMIT FORM
     ===================================================== */

  document
    .querySelectorAll(".register-form")
    .forEach((form) => {

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();


          const eventId =
            form.dataset.eventId;


          /* -------------------------------------------
             KIỂM TRA DEADLINE TRƯỚC KHI GỬI
             ------------------------------------------- */

          if (
            isDeadlinePassed(
              form.dataset.deadline
            )
          ) {

            showRegistrationClosed(
              form,
              form.dataset.deadline
            );

            return;
          }


          /* -------------------------------------------
             LẤY DỮ LIỆU FORM
             ------------------------------------------- */

          const fullName =
            form
              .querySelector(".reg-name")
              .value
              .trim();


          const email =
            form
              .querySelector(".reg-email")
              .value
              .trim();


          const phone =
            form
              .querySelector(".reg-phone")
              .value
              .trim();


          const messageEl =
            document.getElementById(
              `registerMessage-${eventId}`
            );


          /* -------------------------------------------
             LẤY CÂU TRẢ LỜI CÂU HỎI
             ------------------------------------------- */

          const answers = {};


          form
            .querySelectorAll(
              ".reg-answer-input"
            )
            .forEach((input) => {

              answers[
                input.dataset.questionId
              ] = input.value.trim();

            });


          /* -------------------------------------------
             KHÓA NÚT TRONG LÚC GỬI
             ------------------------------------------- */

          const submitBtn =
            form.querySelector(
              'button[type="submit"]'
            );


          submitBtn.disabled = true;

          submitBtn.textContent =
            "Đang gửi...";


          /* -------------------------------------------
             INSERT VÀO SUPABASE
             ------------------------------------------- */

          const { error } =
            await supabaseClient
              .from("event_registrations")
              .insert({

                event_id: eventId,

                full_name: fullName,

                email,

                phone,

                answers,

              });


          /* -------------------------------------------
             MỞ KHÓA NÚT
             ------------------------------------------- */

          submitBtn.disabled = false;

          submitBtn.textContent =
            "Gửi đăng ký";


          /* -------------------------------------------
             XỬ LÝ LỖI
             ------------------------------------------- */

          if (error) {

            messageEl.textContent =
              "❌ Có lỗi xảy ra, vui lòng thử lại: " +
              error.message;

            messageEl.className =
              "register-message register-message-error";

            messageEl.hidden = false;

            return;
          }


          /* -------------------------------------------
             ĐĂNG KÝ THÀNH CÔNG
             ------------------------------------------- */

          messageEl.textContent =
            "✅ Cảm ơn bạn đã đăng ký tham gia! Ban tổ chức sẽ liên hệ khi cần.";

          messageEl.className =
            "register-message register-message-success";

          messageEl.hidden = false;


          form.reset();

          form.hidden = true;


          /* -------------------------------------------
             ĐƯA NÚT VỀ TRẠNG THÁI BAN ĐẦU
             ------------------------------------------- */

          const btn =
            document.querySelector(
              `.btn-toggle-register[data-event-id="${eventId}"]`
            );


          if (btn) {

            btn.textContent =
              "Đăng ký tham gia";

          }

        }
      );

    });
}