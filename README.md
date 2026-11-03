# WorkSchedule & Telegram Pro — Hệ Thống Lịch Làm Việc & Báo Telegram Tự Động

Ứng dụng Web Fullstack (Next.js 14 App Router + TypeScript + TailwindCSS) hỗ trợ:
1. **Lên lịch làm việc định kỳ tùy biến (`RECURRING`):** Lặp lại mỗi `N` ngày/tuần/tháng (VD: **2 ngày 1 lần**, **3 ngày 1 lần**, **Thứ 2 - Thứ 4 - Thứ 6 hàng tuần**, **Ngày 15 & 30 hàng tháng**).
2. **Lịch làm việc tự chọn theo ngày (`MULTI_DATE` & `SINGLE`):** Click chọn nhiều ngày rời rạc bất kỳ trên lịch tương tác hoặc 1 ngày cố định.
3. **Tự động thông báo Telegram theo giờ tự chọn (`notifyTimes`):** Chọn 1 hoặc nhiều khung giờ bất kỳ trong ngày (VD: `08:00`, `13:45`, `16:30`) + nhắc trước giờ làm (`15p`, `30p`, `60p`) + tương tác 2 chiều qua nút bấm trên Telegram (`[✅ Đã hoàn thành]`, `[⏳ Đang xử lý]`, `[⏰ Nhắc lại 15p]`).
4. **Phân quyền bảo mật theo nhân sự (`RBAC`):**
   - **Nhân sự (`STAFF`):** Mỗi nhân sự có tài khoản riêng, **chỉ xem và cập nhật được lịch làm việc của chính mình**.
   - **Quản lý (`MANAGER`):** Xem lịch toàn bộ công ty, lọc theo từng nhân viên, giao việc, thêm/sửa/xóa tài khoản nhân sự và cấu hình Bot Telegram.

---

## Tài khoản khởi tạo sẵn (Mật khẩu chung: `123456`)

| Vai trò | Username | Mật khẩu | Họ tên & Phòng ban | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| **QUẢN LÝ** | `admin` | `123456` | Vũ Hoàng (Ban Giám Đốc) | Xem lịch toàn bộ nhân sự, giao việc, quản lý tài khoản & Bot Telegram |
| **NHÂN SỰ** | `trang` | `123456` | Trang (Kế toán trưởng) | Chỉ xem & xử lý lịch của Trang |
| **NHÂN SỰ** | `minh` | `123456` | Minh Anh (Chuyên viên Thuế) | Chỉ xem & xử lý lịch của Minh Anh |
| **NHÂN SỰ** | `khanh` | `123456` | Quốc Khánh (Marketing & CSKH) | Chỉ xem & xử lý lịch của Quốc Khánh |

---

## Chạy trên máy Local

```bash
cd "C:/Users/Vu Hoang/work-schedule-app"
npm install
npm run dev
```
Truy cập tại: **http://localhost:3005**

---

## Hướng dẫn Deploy lên Vercel chạy tự động 24/7 (Không cần bật máy tính)

1. **Đẩy code lên GitHub** và Import repository vào **Vercel**.
2. **Lưu trữ dữ liệu trên Vercel (Miễn phí 100%):**
   - Trong trang dự án trên Vercel -> vào tab **Storage** -> bấm **Create Database** -> chọn **Upstash Redis (Serverless KV)** gói **Free** và bấm **Connect to Project**.
   - Vercel sẽ tự động điền `KV_REST_API_URL` và `KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), ứng dụng sẽ tự động lưu trữ toàn bộ lịch & nhân sự vĩnh viễn trên Cloud.
3. **Kích hoạt bắn Telegram tự động đúng từng phút:**
   - **Cách 1 (Khuyên dùng - Chính xác từng phút, Free 100%):** Vào trang [cron-job.org](https://cron-job.org), tạo 1 cronjob miễn phí trỏ vào URL:
     `https://<ten-app-cua-ban>.vercel.app/api/cron/notify` với chu kỳ **Every 1 minute (`* * * * *`)**.
   - **Cách 2 (Tích hợp sẵn):** File `.github/workflows/cron-notify.yml` và `vercel.json` đã được cấu hình sẵn trong project.
4. **Kích hoạt nút bấm `[✅ Đã hoàn thành]` trên Telegram:**
   - Sau khi lên Vercel, đăng nhập tài khoản Quản lý (`admin`) -> mở **Cài đặt Telegram Bot** -> nhập `Bot Token` -> bấm nút **"Kích hoạt Telegram Webhook 1-Click"**.
