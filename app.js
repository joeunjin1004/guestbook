import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// DOM 요소 참조
const configWarning = document.getElementById("configWarning");
const errorAlert = document.getElementById("errorAlert");
const errorMessage = document.getElementById("errorMessage");
const guestbookForm = document.getElementById("guestbookForm");
const nameInput = document.getElementById("nameInput");
const messageInput = document.getElementById("messageInput");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const guestbookList = document.getElementById("guestbookList");
const messageCount = document.getElementById("messageCount");

// 1. Firebase Config 검증
function isConfigValid(config) {
  return (
    config &&
    config.apiKey &&
    config.apiKey !== "YOUR_API_KEY" &&
    config.projectId &&
    config.projectId !== "YOUR_PROJECT_ID"
  );
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorAlert.classList.remove("hidden");
}

function hideError() {
  errorAlert.classList.add("hidden");
  errorMessage.textContent = "";
}

// HTML 이스케이프 처리 (XSS 방지)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// 날짜/시간 포맷팅
function formatDate(timestamp) {
  if (!timestamp) return "방금 전";
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// 2. 초기화 및 이벤트 리스너 설정
if (!isConfigValid(firebaseConfig)) {
  configWarning.classList.remove("hidden");
  guestbookList.innerHTML = `
    <div class="status-box">
      <p>💡 <code>firebase-config.js</code> 파일에 Firebase 프로젝트 키를 입력하면 방명록이 활성화됩니다.</p>
    </div>
  `;
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const guestbookCol = collection(db, "guestbook");

    // 실시간 방명록 목록 불러오기 (최신순 정렬)
    const q = query(guestbookCol, orderBy("createdAt", "desc"));

    onSnapshot(
      q,
      (snapshot) => {
        hideError();
        const docs = snapshot.docs;
        messageCount.textContent = `${docs.length}개의 메시지`;

        if (docs.length === 0) {
          guestbookList.innerHTML = `
            <div class="status-box">
              <p>아직 작성된 방명록이 없습니다.<br/>첫 번째 방문자가 되어 따뜻한 인사를 남겨보세요! 🎉</p>
            </div>
          `;
          return;
        }

        guestbookList.innerHTML = docs
          .map((doc) => {
            const data = doc.data();
            const initial = (data.name || "?").trim().charAt(0).toUpperCase();
            const formattedTime = formatDate(data.createdAt);

            return `
              <article class="message-card">
                <div class="message-meta">
                  <div class="user-info">
                    <div class="avatar">${escapeHtml(initial)}</div>
                    <span class="user-name">${escapeHtml(data.name)}</span>
                  </div>
                  <time class="message-time">${formattedTime}</time>
                </div>
                <div class="message-content">${escapeHtml(data.message)}</div>
              </article>
            `;
          })
          .join("");
      },
      (error) => {
        console.error("Firestore 실시간 수신 오류:", error);
        if (error.code === "permission-denied") {
          showError("데이터베이스 접근 권한이 없습니다. Firebase Console의 Cloud Firestore [규칙(Rules)] 탭에서 읽기/쓰기 권한을 확인해 주세요.");
        } else {
          showError(`방명록을 불러오는 중 오류가 발생했습니다: ${error.message}`);
        }
      }
    );

    // 새 방명록 등록 이벤트
    guestbookForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError();

      const name = nameInput.value.trim();
      const message = messageInput.value.trim();

      // 유효성 검사
      if (!name) {
        alert("이름을 입력해 주세요.");
        nameInput.focus();
        return;
      }

      if (!message) {
        alert("메시지를 입력해 주세요.");
        messageInput.focus();
        return;
      }

      // 로딩 UI 시작
      submitBtn.disabled = true;
      btnText.textContent = "등록하는 중...";
      btnSpinner.style.display = "inline-block";

      try {
        await addDoc(guestbookCol, {
          name: name,
          message: message,
          createdAt: serverTimestamp()
        });

        // 폼 초기화
        messageInput.value = "";
        nameInput.focus();
      } catch (error) {
        console.error("방명록 등록 오류:", error);
        if (error.code === "permission-denied") {
          showError("방명록을 등록할 권한이 없습니다. Firestore [규칙(Rules)]을 확인해 주세요.");
        } else {
          showError(`등록에 실패했습니다: ${error.message}`);
        }
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = "방명록 남기기";
        btnSpinner.style.display = "none";
      }
    });

  } catch (initError) {
    console.error("Firebase 초기화 실패:", initError);
    showError(`Firebase 초기화 실패: ${initError.message}`);
  }
}

