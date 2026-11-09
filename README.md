# MindSchool

MindSchool là một MVP tiếng Việt về chăm sóc cảm xúc học đường. Giao diện và API chạy trên máy cá nhân; chatbot dùng phản hồi mock nếu không có khóa OpenAI. Sản phẩm hỗ trợ tự quan sát cảm xúc, không chẩn đoán hay thay thế chuyên gia.

## Yêu cầu

- Node.js 20.19+ (đã kiểm tra trên Node 24.22.1).
- npm 10+.
- MariaDB từ XAMPP tùy chọn để bật lưu trữ bền vững qua Prisma; nếu `DATABASE_URL` để trống, API dùng RAM và dữ liệu demo bị xóa khi dừng backend.

## Cài và chạy

```bash
cd outputs
npm install
Copy-Item .env.example .env
npm run dev
```

Mở `http://localhost:5173`. API health check: `http://localhost:4000/api/health`. Đăng ký tài khoản mới bằng email tùy chọn và mật khẩu tối thiểu 8 ký tự. Backend và frontend cần chạy đồng thời; `npm run dev` khởi động cả hai.

Nếu PowerShell không nhận ra npm, cài Node.js LTS bản Windows từ https://nodejs.org/ rồi mở lại terminal. Không cần API key để thử chatbot.

Trên máy này, thư mục XAMPP tại `D:\HVNH\XAMPP` chứa MariaDB 10.4 và cấu hình cổng 3307. Database `mindschool` và migration ban đầu đã được tạo; `.env` local đã nối backend vào database đó.

## OpenAI tùy chọn

Để dùng mô hình OpenAI thật, tạo API key trong [OpenAI API keys](https://platform.openai.com/api-keys) rồi thêm khóa vào `OPENAI_API_KEY` trong file backend `.env`. Đừng gửi khóa qua chat hoặc đặt ở frontend. Khởi động lại backend sau khi lưu. Theo tài liệu OpenAI, khóa là bearer credential bí mật và phải nằm ở server, không ở trình duyệt. [Tài liệu xác thực OpenAI](https://developers.openai.com/api/reference/overview)

```env
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Thiếu khóa thì backend dùng bộ kịch bản theo từ khóa và giao diện sẽ ghi rõ “Chế độ mô phỏng”. Bộ nhận diện chuẩn hóa tiếng Việt có dấu/không dấu, rồi chọn phản hồi cho các chủ đề như bắt nạt, thi cử/bài tập, bạn bè, gia đình, mất ngủ và cảm xúc. Tín hiệu nguy cơ cao được ưu tiên phản hồi an toàn trước các kịch bản thông thường. Nếu nội dung không khớp, Mây hỏi mở để học sinh chia sẻ thêm. Đây là logic từ khóa với câu trả lời soạn sẵn, không phải mô hình AI tạo nội dung; nếu khóa sai hoặc API lỗi, ứng dụng cũng quay về bộ kịch bản và đánh dấu mô phỏng. Khi AI thật hoạt động, giao diện báo tin nhắn được gửi tới OpenAI. Trước khi triển khai thật, cần kiểm tra chính sách quyền riêng tư, consent dành cho người chưa thành niên, lưu trữ và quy trình hỗ trợ nguy cơ cùng chuyên gia phù hợp.

## Database

`prisma/schema.prisma` mô tả các model User, ChatSession, ChatMessage và MoodRecord, có cascade delete. Prisma dùng provider `mysql`, tương thích MariaDB của XAMPP. Bật MySQL trong XAMPP Control Panel, tạo database `mindschool` trong phpMyAdmin, rồi đặt URL trong `.env`. Nếu root không có mật khẩu, ví dụ:

```env
DATABASE_URL="mysql://root@127.0.0.1:3307/mindschool"
```

Nếu đã đặt mật khẩu cho MariaDB, thêm mật khẩu sau `root:` (ký tự đặc biệt trong mật khẩu cần URL-encode). Sau đó chạy:

```bash
npm run db:generate
npm run db:migrate
```

Khi có `DATABASE_URL`, backend dùng Prisma/MariaDB cho tài khoản, phiên chat, tin nhắn và mood. Không có URL thì backend tự chuyển sang RAM để bản demo chạy ngay. Migration SQL ban đầu nằm trong `prisma/migrations`; bật MySQL trong XAMPP và chạy `npm run db:deploy` để áp dụng. Nếu XAMPP đang dùng cổng khác 3307, sửa URL cho đúng.

## Giáo viên và quản trị viên

Role `student`, `teacher`, `admin` được quản lý ở backend. Để cấp role nhân viên, thêm email vào allowlist trong file `.env` (email phân tách bằng dấu phẩy), ví dụ:

```env
TEACHER_EMAILS=giaovien@truong.edu.vn
ADMIN_EMAILS=quantri@truong.edu.vn
```

Khởi động lại backend rồi để giáo viên đăng ký bằng email được cấp quyền hoặc đăng xuất/đăng nhập lại nếu tài khoản đã tồn tại. Học sinh không thể tự chọn role trên giao diện. Người có role teacher/admin sẽ thấy mục **Bảng điều khiển trường**: thống kê học sinh, check-in cảm xúc và số cuộc trò chuyện trong 7 ngày; cùng tối đa 50 tin nhắn được bộ từ khóa gắn cờ trong 30 ngày để người có trách nhiệm kiểm tra. API kiểm tra quyền staff độc lập với giao diện. Migration thêm role mặc định `student` cho tài khoản cũ, không xóa dữ liệu.

MVP này chưa có phân công lớp nên role teacher/admin xem dữ liệu tổng hợp và các tin nhắn gắn cờ của toàn bộ workspace. Bộ gắn cờ theo từ khóa có thể bỏ sót hoặc nhận nhầm; đây chỉ là danh sách hỗ trợ rà soát, không phải đánh giá/chẩn đoán. Không dùng với dữ liệu học sinh thật trước khi bổ sung phân quyền theo lớp, quy trình consent, chính sách lưu trữ và quy trình xử lý ca cùng chuyên gia phù hợp.

## Kiểm tra

```bash
npm run build
```

Các route chính: `/`, `/signin`, `/signup`, `/app`, `/app/chat`, `/app/mood`, `/app/profile`. API gồm auth, profile, dashboard, chats, messages, moods và health check. Tin nhắn không được ghi vào server log. Tài khoản dùng bcrypt, API riêng cần JWT, dữ liệu chat/mood được giới hạn theo chủ tài khoản; xóa tài khoản sẽ xóa dữ liệu liên quan.

### Phần đã có

- Responsive landing page và trải nghiệm dashboard tiếng Việt.
- Đăng ký/đăng nhập, hash mật khẩu, JWT và bảo vệ route API.
- Chat session, lịch sử tin nhắn, typing indicator, nhận diện từ khóa theo tình huống học đường, câu trả lời kịch bản và lớp phản hồi cố định cho tín hiệu nguy cơ cao.
- Role học sinh/giáo viên/quản trị viên cấp từ allowlist backend; dashboard trường có thống kê 7 ngày và danh sách tín hiệu cần xem lại.
- Check-in cảm xúc, mức độ, ghi chú, biểu đồ tuần và lịch sử.
- Hồ sơ, đăng xuất, xóa tài khoản/dữ liệu.
- Prisma schema, `.env.example`, `.gitignore`.
- Dashboard tổng hợp check-in và hoạt động thật của tài khoản; giới hạn tốc độ cơ bản cho auth và gửi chat.

### Giới hạn hiện tại

- Nếu bỏ `DATABASE_URL`, dữ liệu ở RAM và restart backend sẽ xóa dữ liệu. Kết nối XAMPP/MariaDB đã được kiểm tra trên máy này.
- Chưa có xác minh email, phục hồi mật khẩu hoặc kiểm thử xâm nhập. Đã có giới hạn tốc độ cơ bản cho đăng nhập/đăng ký và gửi chat.
- Bộ nhận diện nguy cơ là một lớp heuristic bảo vệ bổ sung, không thể phát hiện mọi tình huống. Khi gặp nguy cơ tức thời, ứng dụng khuyến khích người dùng tìm người lớn đáng tin cậy/dịch vụ khẩn cấp tại địa phương.
- Biểu đồ 7 ngày và hoạt động gần đây trên dashboard dùng mood check-in và phiên chat thực của tài khoản; khi chưa có dữ liệu, biểu đồ để trống thay vì tạo lịch sử giả.
