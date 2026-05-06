# Ngọt — Pastry & Cake Studio

Hệ thống quản lý tiệm bánh Ngọt: đơn hàng, tồn kho, công thức, khuyến mãi, khách hàng, P&L, thiết bị, và Trợ lý Ngọt (Gemini) phân tích tin nhắn Telegram.

**Stack**: Python 3.11 + Streamlit 1.40 + Google Sheets (gspread 6) + Gemini (`google-genai`) + Telegram Bot API + pandas 2 + pydantic 2.

## Local dev

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/streamlit run streamlit_app.py
```

Sao chép `.streamlit/secrets.toml.example` → `.streamlit/secrets.toml` và điền giá trị thật trước khi chạy.

## Deploy

1. **Streamlit Community Cloud** (free):
   - Đẩy repo lên GitHub.
   - Tạo app mới tại https://share.streamlit.io trỏ vào `streamlit_app.py`.
   - Vào **Settings → Secrets** dán toàn bộ nội dung `.streamlit/secrets.toml` của bạn.
2. **Google Sheet**: tạo 1 spreadsheet, share quyền `Editor` cho service-account email (xem trong service account JSON).
3. **GitHub Actions** (Telegram polling cron): vào **Settings → Secrets and variables → Actions** thêm `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SHEETS_URL`, `GCP_SERVICE_ACCOUNT_JSON`. Workflow `.github/workflows/telegram-poll.yml` sẽ tự chạy mỗi 10 phút.

## Secrets reference

| Key | Where | Required | Notes |
|---|---|---|---|
| `AUTH_PASSWORD` | st.secrets | yes | Nhân viên đăng nhập |
| `ADMIN_PASSWORD` | st.secrets | yes | Quản trị viên (xem công thức/tài chính/audit) |
| `SHEETS_URL` | st.secrets + GH secret | yes | URL spreadsheet đích |
| `GEMINI_API_KEY` | st.secrets | tuỳ chọn | Cần cho Trợ lý Ngọt |
| `TELEGRAM_BOT_TOKEN` | st.secrets + GH secret | tuỳ chọn | Cần cho thu thập đơn qua Telegram |
| `TELEGRAM_CHAT_ID` | st.secrets + GH secret | tuỳ chọn | Lọc theo channel cụ thể |
| `gcp_service_account` | st.secrets (TOML table) | yes | JSON service account, share Editor cho Sheet |
| `GCP_SERVICE_ACCOUNT_JSON` | GH secret (string) | yes (cho cron) | Dùng cho GitHub Actions |

## First-run setup

1. Đăng nhập với `ADMIN_PASSWORD`.
2. Vào **🛠️ Cài đặt** → kiểm tra Sheets/Gemini/Telegram.
3. Vào **📥 Khởi tạo Google Sheet** → bấm "Áp dụng" để tạo 15 tab + 2 tab nội bộ.
4. Vào **Khởi tạo Google Sheet** → "Chạy seed" để load dữ liệu mẫu.
5. Vào **🛠️ Cài đặt → Tài khoản ngân hàng** điền số TK + mã BIN ngân hàng (cần cho VietQR).

## Architecture

- 8 modules (`lib/modules/`): customers, menu, inventory, orders, financials, assistant, + cross-cutting auth/audit.
- Tất cả dữ liệu đi qua `lib/sheets_client.py` (caching `ttl=60`, single-writer lock, exponential backoff).
- Gemini chỉ phân tích/giải thích/sinh nội dung — **không bao giờ tính toán**. Toàn bộ số liệu lên qua pandas.

Xem `assistant_skills.md` cho 6 prompt template của Trợ lý.
