export const metadata = { title: 'Điều khoản — Ngọt' };

export default function TermsPage() {
  return (
    <article className="container max-w-3xl py-12">
      <h1 className="font-display italic text-4xl text-cocoa">Điều khoản sử dụng</h1>
      <p className="text-sm text-muted-foreground mt-2">Cập nhật: 1/5/2026</p>
      <section className="mt-8 space-y-4 text-sm leading-relaxed text-foreground/85">
        <h2 className="text-xl font-semibold">1. Đối tượng áp dụng</h2>
        <p>
          Các điều khoản này áp dụng cho chủ cửa hàng và nhân viên đăng nhập sử dụng ứng dụng
          Ngọt để vận hành tiệm bánh.
        </p>
        <h2 className="text-xl font-semibold mt-4">2. Tài khoản và bảo mật</h2>
        <p>
          Người dùng có trách nhiệm bảo mật thông tin đăng nhập. Mọi hành động trong tài khoản
          đều được ghi nhật ký kiểm toán. Mật khẩu được lưu dạng băm (bcrypt) và không bao giờ
          truyền dạng văn bản thuần.
        </p>
        <h2 className="text-xl font-semibold mt-4">3. Trách nhiệm với dữ liệu khách hàng</h2>
        <p>
          Chủ cửa hàng cam kết tuân thủ Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15 và Nghị định
          356/2025/NĐ-CP, bao gồm việc thu thập đồng ý có thể chứng minh được khi nhập thông tin
          khách hàng và xử lý các yêu cầu DSR trong vòng 30 ngày.
        </p>
        <h2 className="text-xl font-semibold mt-4">4. Tích hợp bên thứ ba</h2>
        <p>
          Telegram Bot và Google Sheets là tính năng tùy chọn. Việc cấu hình API token thuộc
          trách nhiệm của chủ cửa hàng. Ngọt không đọc dữ liệu ngược từ Sheet — chỉ ghi một chiều
          để sao lưu/tham chiếu.
        </p>
        <h2 className="text-xl font-semibold mt-4">5. Giới hạn trách nhiệm</h2>
        <p>
          Ngọt được cung cấp &quot;nguyên trạng&quot;. Chủ cửa hàng tự chịu trách nhiệm về tính
          chính xác của các giao dịch và việc tuân thủ thuế GTGT theo Luật 48/2024/QH15.
        </p>
      </section>
    </article>
  );
}
