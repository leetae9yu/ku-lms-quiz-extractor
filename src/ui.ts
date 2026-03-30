export function renderUiHtml(): string {
  return String.raw`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LMS 퀴즈 추출기</title>
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        height: 100%;
      }

      body {
        margin: 0;
        background: #ffffff;
        color: #202124;
        font: 14px/1.5 Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      }

      main {
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .wrap {
        width: min(560px, 100%);
        display: grid;
        gap: 16px;
        justify-items: center;
        text-align: center;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 36px;
        font-weight: 500;
        letter-spacing: -0.02em;
      }

      button,
      input {
        width: 100%;
        height: 44px;
        border: 1px solid #dfe1e5;
        border-radius: 22px;
        background: #ffffff;
        color: inherit;
        font: inherit;
      }

      input {
        padding: 0 16px;
        outline: none;
      }

      input:focus {
        border-color: #c7c9cc;
      }

      button {
        padding: 0 18px;
        cursor: pointer;
      }

      button:disabled,
      input:disabled {
        cursor: default;
        opacity: 0.65;
      }

      .login {
        width: auto;
        min-width: 132px;
      }

      .extract {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        width: 100%;
      }

      .submit {
        width: auto;
        min-width: 88px;
      }

      .status {
        min-height: 20px;
        font-size: 12px;
        color: #5f6368;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="wrap">
        <h1>LMS 퀴즈 추출기</h1>
        <button id="loginButton" class="login" type="button">LMS 로그인</button>
        <form id="extractForm" class="extract">
          <label for="quizUrl" hidden>퀴즈 URL</label>
          <input
            id="quizUrl"
            name="quizUrl"
            type="url"
            placeholder="퀴즈 URL 입력"
            autocomplete="url"
            spellcheck="false"
          />
          <button id="extractButton" class="submit" type="submit">추출</button>
        </form>
        <div id="statusText" class="status">준비됨</div>
      </section>
    </main>

    <script>
      const loginButton = document.getElementById("loginButton");
      const extractButton = document.getElementById("extractButton");
      const extractForm = document.getElementById("extractForm");
      const quizUrl = document.getElementById("quizUrl");
      const statusText = document.getElementById("statusText");

      function setStatus(message) {
        statusText.textContent = message;
      }

      function normalizeError(error, fallbackMessage) {
        if (!error || typeof error.message !== "string") {
          return fallbackMessage;
        }

        return error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/, "");
      }

      function setBusy(busy) {
        loginButton.disabled = busy;
        extractButton.disabled = busy;
        quizUrl.disabled = busy;
      }

      function getApi(name) {
        if (!window.quizApp || typeof window.quizApp[name] !== "function") {
          return null;
        }

        return window.quizApp[name].bind(window.quizApp);
      }

      loginButton.addEventListener("click", async function () {
        const login = getApi("login");

        if (!login) {
          setStatus("로그인 기능을 찾을 수 없습니다.");
          return;
        }

        setBusy(true);
        setStatus("로그인 창을 여는 중...");

        try {
          await login();
          setStatus("로그인 완료");
        } catch (error) {
          setStatus(normalizeError(error, "로그인에 실패했습니다."));
        } finally {
          setBusy(false);
        }
      });

      extractForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const extract = getApi("extract");
        const url = quizUrl.value.trim();

        if (!url) {
          setStatus("퀴즈 URL을 입력하세요.");
          quizUrl.focus();
          return;
        }

        if (!extract) {
          setStatus("추출 기능을 찾을 수 없습니다.");
          return;
        }

        setBusy(true);
        setStatus("추출 중...");

        try {
          const result = await extract(url);
          if (result && typeof result === "object" && result.outputPath) {
            setStatus("추출 완료: " + result.outputPath);
          } else {
            setStatus("추출 완료");
          }
        } catch (error) {
          setStatus(normalizeError(error, "추출에 실패했습니다."));
        } finally {
          setBusy(false);
        }
      });
    </script>
  </body>
</html>`;
}

export const uiHtml = renderUiHtml();
