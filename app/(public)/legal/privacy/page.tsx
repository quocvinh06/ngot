import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Chính sách bảo mật — Ngọt' };

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  return (
    <article className="container max-w-3xl py-12 prose prose-stone">
      <h1 className="font-display italic text-4xl text-cocoa">{t('privacy_title')}</h1>
      <p className="text-sm text-muted-foreground mt-2">Cập nhật: 1/5/2026</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-foreground/85">
        <p className="font-medium">{t('privacy_governing_law')}</p>

        <h2 className="text-xl font-semibold mt-6">1. Danh mục dữ liệu cá nhân được thu thập</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Họ tên, số điện thoại, địa chỉ giao hàng (đối với khách hàng đặt đơn).</li>
          <li>Email, mật khẩu (đã băm bcrypt) đối với tài khoản nhân viên/chủ cửa hàng.</li>
          <li>Lịch sử đơn hàng và giao dịch nội bộ.</li>
          <li>Dữ liệu kỹ thuật: địa chỉ IP, thời điểm đăng nhập, log kiểm toán.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">2. Mục đích sử dụng</h2>
        <p>
          Quản lý đơn hàng, vận hành cửa hàng, đáp ứng nghĩa vụ kế toán và thuế (Luật 48/2024/QH15),
          và bảo đảm tuân thủ Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Cơ sở pháp lý</h2>
        <p>
          Sự đồng ý có thể chứng minh được của khách hàng (ô tích &ldquo;Tôi đã thông báo và nhận được
          sự đồng ý&rdquo; được lưu kèm dấu thời gian), nghĩa vụ pháp lý kế toán/thuế, và lợi ích hợp
          pháp trong vận hành cửa hàng.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Thời gian lưu trữ</h2>
        <p>
          Dữ liệu cá nhân của khách hàng: tối đa 24 tháng kể từ đơn hàng cuối cùng, sau đó được ẩn
          danh tự động (tên đổi thành &ldquo;KH ẩn danh #ID&rdquo;, các trường liên hệ bị xóa).
          Đơn hàng và chứng từ kế toán được giữ tối thiểu 10 năm theo quy định kế toán.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Quyền của chủ thể dữ liệu (DSR)</h2>
        <p>
          Theo Điều 9 Luật 91/2025/QH15, khách hàng có quyền: truy cập, sao chép, đính chính, xóa,
          hạn chế xử lý, rút lại sự đồng ý. Liên hệ chủ cửa hàng để được hỗ trợ; chủ cửa hàng có
          công cụ xuất dữ liệu (Export DSR) và ẩn danh (Xóa theo PDPL) trong ứng dụng.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. Liên hệ</h2>
        <p>Email: privacy@ngot.local — phản hồi trong vòng 30 ngày làm việc.</p>
      </section>
    </article>
  );
}
