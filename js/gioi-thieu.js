/* =======================================================
   FILE: gioi-thieu.js
   MỤC ĐÍCH: Xử lý logic RIÊNG cho trang Giới thiệu.
   Tách file riêng (không gộp vào main.js) để mỗi trang chỉ
   tải đúng phần JS nó cần, không tải thừa code không dùng đến.
   File này cần data/sample-data.js được nạp TRƯỚC nó (xem
   thứ tự thẻ <script> trong gioi-thieu.html).
   ======================================================= */

document.addEventListener("DOMContentLoaded", () => {
  loadAboutPageContent(); // Lấy Lịch sử thành lập + Mục tiêu hoạt động từ Supabase
  loadAdvisors(); // Lấy Giáo viên cố vấn từ Supabase
  loadLeadershipTerms(); // Lấy Các đời chỉ huy từ Supabase (dữ liệu THẬT)
  loadAchievements(); // Lấy Thành tích từ Supabase (khác các phần trên, vì đây là dữ liệu THẬT, không phải data mẫu)

  // LƯU Ý QUAN TRỌNG: initMobileNav(), initBackToTop(), setFooterYear()
  // KHÔNG được gọi lại ở đây nữa — chúng ĐÃ được gọi sẵn bên trong
  // main.js (cũng lắng nghe DOMContentLoaded). main.js luôn nạp TRƯỚC
  // file này (xem thứ tự <script> trong gioi-thieu.html), nên tới lúc
  // DOMContentLoaded bắn ra, main.js chắc chắn đã kịp gắn xong.
  // Gọi lại lần nữa ở đây sẽ khiến initMobileNav() gắn THÊM 1 sự kiện
  // click trùng lặp vào nút hamburger → bấm 1 cái, menu bật lên rồi
  // tự đóng lại ngay lập tức (2 listener toggle triệt tiêu nhau) →
  // đây chính là nguyên nhân khiến menu mobile "im re" trên trang này.
  initAchievementDetailModal();
  initAdvisorDetailModal();
});

/* =======================================================
   PHẦN 1: LỊCH SỬ THÀNH LẬP + MỤC TIÊU HOẠT ĐỘNG
   (dữ liệu THẬT từ Supabase, bảng "about_page" — chỉ có
   đúng 1 dòng duy nhất, Admin sửa ở admin-about.html)
   ======================================================= */
async function loadAboutPageContent() {
  const { data, error } = await supabaseClient
    .from("about_page")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    console.error("Lỗi tải about_page:", error);
    // Nếu lỗi, vẫn cố hiện 1 thông báo thân thiện thay vì để "Đang tải..." mãi
    const founderEl = document.getElementById("founderInfo");
    if (founderEl) founderEl.innerHTML = '<p class="loading-text">Không tải được dữ liệu.</p>';
    const goalsEl = document.getElementById("operationGoals");
    if (goalsEl) goalsEl.innerHTML = '<li class="loading-text">Không tải được dữ liệu.</li>';
    return;
  }

  renderFounderInfo(data);
  renderOperationGoals(data.goals);
}

function renderFounderInfo(data) {
  const container = document.getElementById("founderInfo");
  if (!container) return;

  // Nếu Admin CHƯA điền gì (mọi trường đều rỗng), hiện gợi ý thay
  // vì để trống trơn khó hiểu
  if (!data.founder_name && !data.founded_year && !data.founder_description) {
    container.innerHTML = '<p class="loading-text">Chưa có thông tin. Admin cập nhật ở trang "Quản lý trang Giới thiệu".</p>';
    return;
  }

  container.innerHTML = `
    ${data.founded_year ? `<p class="founder-year">Thành lập: <strong>${data.founded_year}</strong></p>` : ""}
    ${data.founder_name ? `<p class="founder-name">Người sáng lập: <strong>${data.founder_name}</strong></p>` : ""}
    ${data.founder_description ? `<p class="founder-desc">${data.founder_description}</p>` : ""}
  `;
}

/* =======================================================
   MỤC TIÊU HOẠT ĐỘNG
   ---------------------------------------------------------
   REDESIGN: mỗi mục tiêu (không phải dòng tiêu đề phụ) giờ
   được render thành 1 THẺ (.goal-card) có icon khung riêng,
   nền gradient xoay vòng theo 3 biến thể màu, và số thứ tự
   mờ ở góc (01, 02, 03...) — xem CSS tương ứng trong
   style.css. Dữ liệu "goals" trong Supabase VẪN LÀ mảng chuỗi
   text đơn giản như cũ, không đổi schema/cách Admin nhập liệu.
   Dòng tiêu đề phụ (kết thúc bằng dấu ":") vẫn được nhận diện
   và render riêng như trước, KHÔNG bị đánh số hay gắn icon.
   ======================================================= */
function renderOperationGoals(goals) {
  const container = document.getElementById("operationGoals");
  if (!container) return;

  if (!goals || goals.length === 0) {
    container.innerHTML = '<li class="loading-text">Chưa có dữ liệu mục tiêu.</li>';
    return;
  }

  // 3 icon xoay vòng (khiên / tia sét / trái tim) — giống ảnh mẫu
  const GOAL_ICONS = [
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  ];

  // Đếm riêng số MỤC TIÊU THẬT (bỏ qua dòng tiêu đề phụ kiểu "Các mục tiêu chính gồm:")
  // để đánh số 01, 02, 03... và xoay vòng icon/màu đúng thứ tự hiển thị
  let goalIndex = 0;

  container.innerHTML = goals
    .map((goal) => {
      const isHeadingLine = /[:：]\s*$/.test(String(goal).trim());
      if (isHeadingLine) {
        return `<li class="goals-list-heading">${goal}</li>`;
      }

      const variant = (goalIndex % 3) + 1; // 1, 2, hoặc 3 -> ứng với 3 màu gradient khác nhau
      const icon = GOAL_ICONS[goalIndex % GOAL_ICONS.length];
      goalIndex++;
      const numberLabel = String(goalIndex).padStart(2, "0");

      return `
        <li class="goal-card goal-card--variant-${variant}">
          <span class="goal-card-icon">${icon}</span>
          <p class="goal-card-text">${goal}</p>
          <span class="goal-card-number" aria-hidden="true">${numberLabel}</span>
        </li>
      `;
    })
    .join("");
}

/* =======================================================
   PHẦN 1B: GIÁO VIÊN CỐ VẤN (dữ liệu THẬT từ Supabase)
   ---------------------------------------------------------
   BỐ CỤC MỚI (theo bản vẽ tay của Haoo): mỗi giáo viên cố vấn
   là 1 THẺ NGANG gồm 2 cột:
     - Cột trái: ảnh tròn (Hình cố vấn) + ô nhỏ bên dưới ghi
       Tên cố vấn.
     - Cột phải: 1 khung to hiển thị TRỰC TIẾP nội dung
       "Giới thiệu" (bio), không cần bấm vào mới xem được.
   Thẻ vẫn giữ được bấm vào để mở modal xem full-size (giữ
   nguyên tính năng cũ, hữu ích trên màn hình nhỏ khi khung
   giới thiệu bị thu ngắn lại).
   ======================================================= */
async function loadAdvisors() {
  const container = document.getElementById("advisorsGrid");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("advisor_teachers")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    container.innerHTML = '<p class="loading-text">Không tải được dữ liệu. Vui lòng thử lại sau.</p>';
    console.error("Lỗi tải advisor_teachers:", error);
    return;
  }

  renderAdvisors(data);
}

let allAdvisors = [];

function renderAdvisors(items) {
  const container = document.getElementById("advisorsGrid");
  allAdvisors = items;

  // Đổi từ lưới thẻ tròn nhiều cột (org-cards-grid) sang danh sách
  // thẻ ngang xếp chồng theo hàng dọc — chỉ áp dụng riêng cho
  // #advisorsGrid (xem CSS ".advisors-list"), KHÔNG đụng tới
  // .org-cards-grid dùng chung ở "Các đời chỉ huy" / Cơ cấu tổ chức.
  container.classList.add("advisors-list");

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="loading-text">Chưa có thông tin giáo viên cố vấn.</p>';
    return;
  }

  container.innerHTML = items
    .map(
      (t) => `
      <div class="advisor-card" data-id="${t.id}">
        <div class="advisor-card-photo-col">
          <img
            src="${t.image_url || "https://via.placeholder.com/160x160?text=Chưa+có+ảnh"}"
            alt="${t.name}"
            class="advisor-card-img"
          />
          <div class="advisor-card-name-box">
            <span class="advisor-card-title">${t.title || "Giáo viên cố vấn"}</span>
            <h3 class="advisor-card-name">${t.name}</h3>
          </div>
        </div>
        <div class="advisor-card-intro-box">
          <p class="advisor-card-bio">${t.bio || "Chưa có giới thiệu."}</p>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll("#advisorsGrid .advisor-card").forEach((card) => {
    card.addEventListener("click", () => {
      const item = allAdvisors.find((t) => t.id == card.dataset.id);
      if (item) openAdvisorDetailModal(item);
    });
  });
}

function openAdvisorDetailModal(item) {
  const modal = document.getElementById("advisorDetailModal");
  if (!modal) return;

  document.getElementById("advisorDetailImg").src =
    item.image_url || "https://via.placeholder.com/160x160?text=Chưa+có+ảnh";
  document.getElementById("advisorDetailImg").alt = item.name;
  document.getElementById("advisorDetailTitle").textContent = item.title || "Giáo viên cố vấn";
  document.getElementById("advisorDetailName").textContent = item.name;
  document.getElementById("advisorDetailBio").textContent = item.bio || "Chưa có giới thiệu.";

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAdvisorDetailModal() {
  const modal = document.getElementById("advisorDetailModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function initAdvisorDetailModal() {
  const modal = document.getElementById("advisorDetailModal");
  const closeBtn = document.getElementById("advisorDetailClose");
  if (!modal || !closeBtn) return;

  closeBtn.addEventListener("click", closeAdvisorDetailModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAdvisorDetailModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeAdvisorDetailModal();
  });
}

/* =======================================================
   PHẦN 2: CÁC ĐỜI CHỈ HUY (dữ liệu THẬT từ Supabase)
   ---------------------------------------------------------
   CẬP NHẬT QUAN TRỌNG: từ khi tách bảng, bảng "leadership_terms"
   giờ đại diện cho ĐÚNG 1 NHIỆM KỲ (không còn là 1 chỉ huy nữa).
   Mỗi nhiệm kỳ có ẢNH RIÊNG (do Admin tự upload) + TÊN RIÊNG,
   KHÔNG liên quan gì tới việc nhiệm kỳ đó có bao nhiêu chỉ huy.
   Vì vậy ở đây CHỈ query bảng "leadership_terms" — KHÔNG cần lấy
   danh sách chỉ huy (bảng "leadership_members") vì trang Giới
   thiệu không hiện chi tiết từng người, chỉ hiện card nhiệm kỳ.
   Toàn bộ chỉ huy chi tiết của từng nhiệm kỳ nằm ở trang riêng
   "chi-huy-qua-cac-nhiem-ky.html" (xem js/chi-huy-cac-nhiem-ky.js).

   Mỗi card vẫn là 1 LINK dẫn thẳng đến đúng nhiệm kỳ trên trang
   đó, bằng đúng cơ chế slug/anchor như trước.

   QUAN TRỌNG: hàm slugifyLeadershipTerm() bên dưới PHẢI tạo ra
   CHÍNH XÁC cùng 1 chuỗi id như hàm cùng tên bên
   js/chi-huy-cac-nhiem-ky.js — nếu sau này sửa 1 bên, nhớ sửa
   luôn bên kia cho khớp, không thì link sẽ dẫn sai chỗ.
   ======================================================= */
async function loadLeadershipTerms() {
  const container = document.getElementById("leadershipTimeline");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("leadership_terms")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    container.innerHTML = '<p class="loading-text">Không tải được dữ liệu. Vui lòng thử lại sau.</p>';
    console.error("Lỗi tải leadership_terms:", error);
    return;
  }

  renderLeadershipTerms(data);
}

function slugifyLeadershipTerm(termName, period) {
  const raw = `${termName || ""} ${period || ""}`;
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu (dựa trên Unicode combining marks)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // mọi ký tự không phải chữ/số -> gạch nối
    .replace(/^-+|-+$/g, ""); // bỏ gạch nối dư ở đầu/cuối
  return "nk-" + slug;
}

function renderLeadershipTerms(terms) {
  const container = document.getElementById("leadershipTimeline");

  if (!terms || terms.length === 0) {
    container.innerHTML = '<p class="loading-text">Chưa có dữ liệu nhiệm kỳ.</p>';
    return;
  }

  container.innerHTML = terms
    .map((t) => {
      const anchorId = slugifyLeadershipTerm(t.term_name, t.period);
      return `
      <a class="org-card" href="chi-huy-qua-cac-nhiem-ky.html#${anchorId}">
        <img
          src="${t.image_url || "https://via.placeholder.com/160x160?text=Chưa+có+ảnh"}"
          alt="${t.term_name}"
          class="org-card-img"
        />
        <div>
          <span class="org-card-title">Nhiệm kỳ</span>
          <h3 class="org-card-name">${t.term_name}${t.period ? " • " + t.period : ""}</h3>
        </div>
      </a>
    `;
    })
    .join("");
}

/* =======================================================
   PHẦN 5: THÀNH TÍCH (dữ liệu THẬT từ Supabase)
   ======================================================= */
async function loadAchievements() {
  const container = document.getElementById("achievementsGrid");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("achievements")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    container.innerHTML = '<p class="loading-text">Không tải được dữ liệu. Vui lòng thử lại sau.</p>';
    console.error("Lỗi tải achievements:", error);
    return;
  }

  renderAchievements(data);
}

/* =======================================================
   CẬP NHẬT (theo yêu cầu): bỏ nút "Xem chi tiết →" khỏi thẻ
   Thành tích. Toàn thẻ (trừ vùng ảnh — ảnh vẫn dùng để phóng to
   qua lightbox) giờ bấm được để mở khung chi tiết. Xem thêm ở
   hàm attachAchievementEvents() bên dưới.
   ======================================================= */
function renderAchievements(items) {
  const container = document.getElementById("achievementsGrid");

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="loading-text">Chưa có thành tích nào được cập nhật.</p>';
    return;
  }

  container.innerHTML = items
    .map((a) => {
      // Gom toàn bộ ảnh: ưu tiên mảng "image_urls" (nhiều ảnh), dự
      // phòng "image_url" (bài cũ trước khi có tính năng nhiều ảnh)
      const images = a.image_urls && a.image_urls.length > 0 ? a.image_urls : a.image_url ? [a.image_url] : [];
      const mainImage = images[0];
      const extraImages = images.slice(1);

      return `
      <div class="achievement-card" data-id="${a.id}">
        ${
          mainImage
            ? `<img src="${mainImage}" alt="${a.title}" class="achievement-img achievement-img-clickable" data-images='${JSON.stringify(images)}' data-index="0" data-caption="${a.title}" />`
            : ""
        }
        <div class="achievement-body">
          ${a.year ? `<span class="achievement-year">${a.year}</span>` : ""}
          <h3 class="achievement-title">${a.title}</h3>
          ${a.description ? `<p class="achievement-desc">${a.description}</p>` : ""}

          ${
            extraImages.length > 0
              ? `
            <div class="achievement-extra-images">
              ${extraImages
                .map(
                  (url, i) => `
                <img src="${url}" alt="${a.title}" class="achievement-thumb" data-images='${JSON.stringify(images)}' data-index="${i + 1}" data-caption="${a.title}" />
              `
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");

  // Ghi nhớ toàn bộ danh sách vừa tải, để hàm mở modal tra lại được
  // đầy đủ nội dung (kể cả content_blocks) mà không cần gọi lại Supabase
  allAchievements = items;

  attachAchievementEvents();
}

// Biến ghi nhớ dữ liệu Thành tích ĐANG hiển thị (dùng chung cho modal chi tiết)
let allAchievements = [];

// Bấm vào ảnh (chính hoặc ảnh phụ) → phóng to xem, dùng openLightbox
// dùng chung (định nghĩa trong main.js). Bấm vào bất kỳ đâu khác trên
// thẻ Thành tích → mở khung chi tiết (thay cho nút "Xem chi tiết →" cũ
// đã bị bỏ khỏi HTML render ở trên).
function attachAchievementEvents() {
  document.querySelectorAll(".achievement-img-clickable, .achievement-thumb").forEach((img) => {
    img.addEventListener("click", (e) => {
      e.stopPropagation(); // chặn không cho nổi bọt lên card, tránh mở luôn cả 2 khung cùng lúc
      const images = JSON.parse(img.dataset.images);
      const index = Number(img.dataset.index);
      openLightbox(images, index, img.dataset.caption);
    });
  });

  // Bấm vào bất kỳ đâu trên thẻ Thành tích (trừ ảnh) → mở khung chi tiết
  document.querySelectorAll(".achievement-card").forEach((card) => {
    card.addEventListener("click", () => {
      const item = allAchievements.find((a) => a.id == card.dataset.id); // == vì dataset là chuỗi
      if (item) openAchievementDetailModal(item);
    });
  });
}

/* =======================================================
   MODAL "XEM CHI TIẾT" THÀNH TÍCH — hiện tiêu đề, năm, ảnh
   đại diện, và toàn bộ "content_blocks" (chữ+ảnh xen kẽ theo
   đúng thứ tự Admin đã sắp xếp bằng ▲▼)
   ======================================================= */
function openAchievementDetailModal(item) {
  const modal = document.getElementById("achievementDetailModal");
  if (!modal) return;

  document.getElementById("achievementDetailTitle").textContent =
    item.title + (item.year ? ` (${item.year})` : "");

  const bodyEl = document.getElementById("achievementDetailBody");
  const hasBlocks = item.content_blocks && item.content_blocks.length > 0;

  if (hasBlocks) {
    renderContentBlocksHTML(bodyEl, item.content_blocks, item.title);
  } else {
    // Bài CŨ chưa có content_blocks — dự phòng bằng mô tả ngắn có sẵn
    bodyEl.innerHTML = item.description ? `<p>${item.description}</p>` : "<p>Chưa có nội dung chi tiết.</p>";
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAchievementDetailModal() {
  const modal = document.getElementById("achievementDetailModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function initAchievementDetailModal() {
  const modal = document.getElementById("achievementDetailModal");
  const closeBtn = document.getElementById("achievementDetailClose");
  if (!modal || !closeBtn) return;

  closeBtn.addEventListener("click", closeAchievementDetailModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAchievementDetailModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeAchievementDetailModal();
  });
}

// Vẽ nội dung dạng "khối" (content_blocks): mỗi khối là 1 đoạn văn,
// 1 ảnh, hoặc 1 video, hiển thị ĐÚNG THEO THỨ TỰ trong mảng. Các khối
// ảnh bấm vào phóng to (lightbox), chuyển qua lại được giữa các ảnh
// trong CÙNG bài — giống cách làm ở trang chi tiết tin tức.
function renderContentBlocksHTML(container, blocks, title) {
  const imageUrls = blocks.filter((b) => b.type === "image").map((b) => b.url);
  let imageIndexCounter = 0;

  container.innerHTML = blocks
    .map((block) => {
      if (block.type === "text") {
        return `<p class="news-block-text">${block.text}</p>`;
      }

      if (block.type === "image") {
        const thisIndex = imageIndexCounter;
        imageIndexCounter++;
        return `<img src="${block.url}" alt="${title}" class="news-block-img" data-index="${thisIndex}" />`;
      }

      if (block.type === "video") {
        if (block.source === "file") {
          return `
            <div class="news-detail-block-video-wrap">
              <video src="${block.url}" controls preload="metadata"></video>
            </div>
          `;
        }
        const embedUrl = toGioiThieuEmbedUrl(block.url || "");
        return embedUrl
          ? `
            <div class="news-detail-block-video-wrap">
              <iframe src="${embedUrl}" allowfullscreen></iframe>
            </div>
          `
          : "";
      }

      return "";
    })
    .join("");

  container.querySelectorAll(".news-block-img").forEach((img) => {
    img.addEventListener("click", () => {
      openLightbox(imageUrls, Number(img.dataset.index), title);
    });
  });
}

/* --------- Chuyển link video người dùng dán vào → link nhúng iframe.
   Cùng logic với content-blocks-editor.js / tin-tuc-chi-tiet.js --------- */
function toGioiThieuEmbedUrl(rawUrl) {
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