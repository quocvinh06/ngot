"""Order detail — bill preview, status transitions, mark-paid."""
from __future__ import annotations

import streamlit as st

from lib.auth import current_role, require_auth
from lib.brand_logo import render_brand_logo
from lib.format_vi import format_date_vi, format_vnd
from lib.i18n import t
from lib.modules import customers as cust_mod
from lib.modules import orders as ord_mod

st.set_page_config(page_title="Chi tiết đơn — Ngọt", page_icon="🧾", layout="wide")
with st.sidebar:
    render_brand_logo("both", size_px=44)

require_auth()

st.title(t("nav.order_detail"))

# Order id from session_state or query param
order_id = st.session_state.get("selected_order_id")
if order_id is None:
    qp = st.query_params.get("id")
    if qp:
        try:
            order_id = int(qp)
        except (ValueError, TypeError):
            order_id = None

if order_id is None:
    order_id_inp = st.number_input("Nhập # đơn cần xem", min_value=1, step=1)
    if st.button("Mở"):
        st.session_state.selected_order_id = int(order_id_inp)
        st.rerun()
    st.stop()

order = ord_mod.get(int(order_id))
if order is None:
    st.error(f"Không tìm thấy đơn #{order_id}.")
    st.stop()

customer = cust_mod.get(order.customer_id) if order.customer_id else None
items = ord_mod.list_items(order.id)
settings = ord_mod.settings_dict()

# Header
hcol1, hcol2 = st.columns([3, 1])
with hcol1:
    st.subheader(f"Đơn #{order.id}")
    if customer:
        st.caption(f"Khách: **{customer.name}** · {customer.phone}")
    st.caption(
        f"Ngày: {format_date_vi(order.order_date)} · Giao: {format_date_vi(order.delivery_date)} · "
        f"Trạng thái: **{t(f'status.{order.status}')}**"
    )
with hcol2:
    st.metric("Tổng cộng", format_vnd(order.total_vnd))
    if order.paid_at:
        st.success(f"✓ Đã thu ({order.payment_method or '?'})")

st.markdown("---")

# Items table
st.subheader("Danh sách món")
if not items:
    st.info("Đơn không có món.")
else:
    rows = []
    for it in items:
        rows.append(
            {
                "Món": it.dish_name_snapshot,
                "SL": it.quantity,
                "Đơn giá": format_vnd(it.unit_price_vnd),
                "Thành tiền": format_vnd(it.subtotal_vnd),
                "Ghi chú": it.notes or "",
            }
        )
    st.dataframe(rows, use_container_width=True, hide_index=True)

st.markdown(
    f"**{t('bill.subtotal')}**: {format_vnd(order.subtotal_vnd)}  \n"
    + (
        f"**{t('bill.discount')}**: −{format_vnd(int(order.subtotal_vnd or 0) - int(order.total_vnd or 0))}  \n"
        if order.subtotal_vnd != order.total_vnd
        else ""
    )
    + f"### {t('bill.total')}: {format_vnd(order.total_vnd)}"
)

st.markdown("---")

# Status transition
st.subheader("Cập nhật trạng thái")
status_options = {
    "confirmed": "Xác nhận đơn",
    "in_progress": "Bắt đầu làm",
    "ready": "Sẵn sàng",
    "delivered": "Đã giao",
    "cancelled": "Huỷ đơn",
}
sc = st.columns(5)
for i, (status, label) in enumerate(status_options.items()):
    with sc[i]:
        disabled = order.status == status
        if st.button(label, key=f"st_{status}", use_container_width=True, disabled=disabled):
            ok = ord_mod.transition_status(order.id, status, current_role() or "staff")
            if ok:
                st.success(f"Đã chuyển sang: {label}")
                st.rerun()
            else:
                st.error("Không thể chuyển trạng thái này.")

st.markdown("---")

# Bill + VietQR
st.subheader("Hoá đơn & thanh toán")
bcol1, bcol2 = st.columns([2, 1])
with bcol1:
    bank = settings.get("bank_name", "")
    acct = settings.get("bank_account_number", "")
    holder = settings.get("bank_account_holder", "")
    st.markdown(
        f"""
**{t('bill.bank_label')}:**

- {t('bill.shop_label')}: {settings.get('shop_name', 'Ngọt')}
- {t('settings.bank_name')}: {bank or '_(chưa thiết lập)_'}
- {t('settings.bank_account')}: `{acct or '_(chưa thiết lập)_'}`
- {t('settings.bank_holder')}: {holder or '_(chưa thiết lập)_'}
- Nội dung: `Thanh toan don NGOT-{order.id}`
"""
    )
    try:
        cust_dict = customer.model_dump() if customer else None
        pdf_bytes = ord_mod.generate_bill_pdf(order.id, settings, cust_dict)
        st.download_button(
            t("cta.download_bill"),
            data=pdf_bytes,
            file_name=f"hoa-don-NGOT-{order.id}.pdf",
            mime="application/pdf",
            use_container_width=True,
        )
    except Exception as e:  # noqa: BLE001
        st.warning(f"Chưa thể tạo PDF: {e}")

with bcol2:
    st.caption(t("bill.vietqr_label"))
    try:
        qr_png = ord_mod.generate_vietqr(order.id, settings)
        st.image(qr_png, width=240)
    except Exception as e:  # noqa: BLE001
        st.info(f"Cần thiết lập số tài khoản trong Cài đặt. ({e})")

if not order.paid_at:
    st.markdown("---")
    pmcol1, pmcol2 = st.columns([3, 1])
    with pmcol1:
        method = st.selectbox(
            "Phương thức thanh toán",
            ["vietqr", "bank_transfer", "cash", "other"],
            format_func=lambda m: {
                "vietqr": "VietQR",
                "bank_transfer": "Chuyển khoản (thủ công)",
                "cash": "Tiền mặt",
                "other": "Khác",
            }[m],
        )
    with pmcol2:
        if st.button("💵 " + t("cta.mark_paid"), type="primary", use_container_width=True):
            ord_mod.mark_paid(order.id, payment_method=method, actor_role=current_role() or "staff")
            st.success("Đã đánh dấu thanh toán.")
            st.rerun()
