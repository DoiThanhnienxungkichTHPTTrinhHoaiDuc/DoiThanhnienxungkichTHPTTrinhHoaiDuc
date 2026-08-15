/* =======================================================
   FILE: registration-questions-editor.js
   MỤC ĐÍCH: Khung thêm/xóa "câu hỏi đăng ký" (bắt buộc trả
   lời khi người dùng đăng ký tham gia sự kiện). Dùng chung
   cho cả form "Tạo sự kiện mới" và từng dòng sự kiện trong
   danh sách (khi sửa sự kiện).

   Cách dùng:
     const api = initRegQuestionsEditor(containerEl, initialQuestions);
     api.getQuestions()  -> [{ id, text }, ...] (đã lọc bỏ câu hỏi bỏ trống)
     api.reset()         -> xóa hết câu hỏi, dùng sau khi tạo sự kiện xong

   containerEl cần có sẵn bên trong:
     <div class="reg-questions-list"></div>
     <button type="button" class="btn-add-question">...</button>
   ======================================================= */

function initRegQuestionsEditor(containerEl, initialQuestions) {
  const listEl = containerEl.querySelector(".reg-questions-list");
  const addBtn = containerEl.querySelector(".btn-add-question");

  // Bản sao nội bộ, không đụng vào mảng gốc được truyền vào
  let questions = (initialQuestions || []).map((q) => ({ id: q.id, text: q.text }));

  render();

  addBtn.addEventListener("click", () => {
    questions.push({ id: generateQuestionId(), text: "" });
    render();
  });

  function render() {
    if (questions.length === 0) {
      listEl.innerHTML = '<p class="reg-questions-empty">Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" nếu muốn hỏi thêm thông tin khi người dùng đăng ký.</p>';
      return;
    }

    listEl.innerHTML = questions
      .map(
        (q) => `
        <div class="reg-question-row" data-id="${q.id}">
          <input
            type="text"
            class="reg-question-text-input"
            value="${escapeHtmlAttrRQ(q.text)}"
            placeholder="VD: Bạn thuộc chi đoàn/lớp nào?"
          />
          <button type="button" class="btn-remove-question" title="Xóa câu hỏi này">✕</button>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll(".reg-question-row").forEach((row) => {
      const id = row.dataset.id;

      row.querySelector(".reg-question-text-input").addEventListener("input", (e) => {
        const q = questions.find((item) => item.id === id);
        if (q) q.text = e.target.value;
      });

      row.querySelector(".btn-remove-question").addEventListener("click", () => {
        questions = questions.filter((item) => item.id !== id);
        render();
      });
    });
  }

  return {
    // Trả về danh sách câu hỏi hợp lệ (đã trim, bỏ câu rỗng)
    // -- dùng khi lưu xuống Supabase
    getQuestions() {
      return questions
        .map((q) => ({ id: q.id, text: (q.text || "").trim() }))
        .filter((q) => q.text.length > 0);
    },
    reset() {
      questions = [];
      render();
    },
  };
}

function generateQuestionId() {
  return "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function escapeHtmlAttrRQ(text) {
  return String(text || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}