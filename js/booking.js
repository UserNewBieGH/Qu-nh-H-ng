/**
 * Booking Engine for Cô Tư Alley Tour
 * Handles pricing, guest counts, voucher codes, validation, orders & tickets
 */

window.BookingEngine = (function() {
  // State
  let adults = 2;
  let children = 0;
  let appliedPromo = null;
  let selectedPayment = "vietqr";
  let countdownTimer = { min: 23, sec: 48, interval: null };

  const ADULT_PRICE = 590000;
  const CHILD_PRICE = 350000;

  function init() {
    setupEventListeners();
    setupBookingModeSwitcher();
    initPreBooking();
    startCountdown();
    updateCalculation();
    setDefaultDate();
    updatePaymentCardStyles();
    autoFillUserBookingInfo();
  }

  function setupBookingModeSwitcher() {
    const btnDirect = document.getElementById('btn-mode-direct-book');
    const btnPre = document.getElementById('btn-mode-pre-book');
    const wrapDirect = document.getElementById('booking-direct-form-wrapper');
    const wrapPre = document.getElementById('prebook-form-wrapper');

    if (btnDirect && btnPre) {
      btnDirect.addEventListener('click', () => switchBookingMode('direct'));
      btnPre.addEventListener('click', () => switchBookingMode('prebook'));
    }
  }

  function switchBookingMode(mode) {
    const btnDirect = document.getElementById('btn-mode-direct-book');
    const btnPre = document.getElementById('btn-mode-pre-book');
    const wrapDirect = document.getElementById('booking-direct-form-wrapper');
    const wrapPre = document.getElementById('prebook-form-wrapper');
    const directSummary = document.getElementById('direct-booking-summary-card');
    const preSummary = document.getElementById('prebook-summary-card');

    if (mode === 'direct') {
      btnDirect?.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
      btnDirect?.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
      btnPre?.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
      btnPre?.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
      wrapDirect?.classList.remove('hidden');
      wrapPre?.classList.add('hidden');
      directSummary?.classList.remove('hidden');
      preSummary?.classList.add('hidden');
    } else {
      btnPre?.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
      btnPre?.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
      btnDirect?.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
      btnDirect?.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
      wrapPre?.classList.remove('hidden');
      wrapDirect?.classList.add('hidden');
      directSummary?.classList.add('hidden');
      preSummary?.classList.remove('hidden');
      autoFillUserBookingInfo();
      updatePrebookSummary();
    }
  }

  function autoFillUserBookingInfo() {
    if (!window.AuthManager) return;
    const user = window.AuthManager.getCurrentUser();
    if (!user || user.role !== 'customer') return;

    const setField = (el, val) => {
      if (!el) return;
      if (!el.value || (el.dataset && el.dataset.autofilled === 'true')) {
        el.value = val;
        if (el.dataset) el.dataset.autofilled = 'true';
      }
    };

    // Direct booking form
    setField(document.getElementById('book-cust-name'), user.fullName || '');
    setField(document.getElementById('book-cust-phone'), user.phone || '');
    setField(document.getElementById('book-cust-email'), user.email || '');

    // Pre-booking form
    setField(document.getElementById('prebook-cust-name'), user.fullName || '');
    setField(document.getElementById('prebook-cust-phone'), user.phone || '');
    setField(document.getElementById('prebook-cust-email'), user.email || '');

    const preDietary = document.getElementById('prebook-dietary');
    if (preDietary && (!preDietary.value || preDietary.value === 'Ăn được tất cả' || (preDietary.dataset && preDietary.dataset.autofilled === 'true'))) {
      preDietary.value = user.dietary || 'Ăn được tất cả';
      if (preDietary.dataset) preDietary.dataset.autofilled = 'true';
    }
  }

  function setDefaultDate() {
    const dateInput = document.getElementById('book-tour-date');
    if (dateInput) {
      const now = new Date();
      const todayY = now.getFullYear();
      const todayM = String(now.getMonth() + 1).padStart(2, '0');
      const todayD = String(now.getDate()).padStart(2, '0');
      
      // Set min date to today so users cannot pick past dates
      dateInput.min = `${todayY}-${todayM}-${todayD}`;

      // Default selected date: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
  }

  function setupEventListeners() {
    // Adult counter
    const btnAdultDec = document.getElementById('btn-adult-dec');
    const btnAdultInc = document.getElementById('btn-adult-inc');
    if (btnAdultDec) {
      btnAdultDec.addEventListener('click', () => {
        if (adults > 1) {
          adults--;
          updateCalculation();
        }
      });
    }
    if (btnAdultInc) {
      btnAdultInc.addEventListener('click', () => {
        if (adults + children < 16) {
          adults++;
          updateCalculation();
        }
      });
    }

    // Child counter
    const btnChildDec = document.getElementById('btn-child-dec');
    const btnChildInc = document.getElementById('btn-child-inc');
    if (btnChildDec) {
      btnChildDec.addEventListener('click', () => {
        if (children > 0) {
          children--;
          updateCalculation();
        }
      });
    }
    if (btnChildInc) {
      btnChildInc.addEventListener('click', () => {
        if (adults + children < 16) {
          children++;
          updateCalculation();
        }
      });
    }

    // Quick Date Options (Hôm nay, Ngày mai, Tùy chọn)
    const dateChips = document.querySelectorAll('.date-slot-chip');
    dateChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dateChips.forEach(c => {
          c.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'border-primary');
          c.classList.add('border-outline-variant/40');
        });
        chip.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'border-primary');
        chip.classList.remove('border-outline-variant/40');
        
        const slotType = chip.getAttribute('data-slot');
        const customDateWrap = document.getElementById('custom-date-wrapper');
        const dateInput = document.getElementById('book-tour-date');
        
        const now = new Date();
        if (slotType === 'today') {
          if (customDateWrap) customDateWrap.classList.add('hidden');
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          if (dateInput) dateInput.value = `${yyyy}-${mm}-${dd}`;
        } else if (slotType === 'tomorrow') {
          if (customDateWrap) customDateWrap.classList.add('hidden');
          now.setDate(now.getDate() + 1);
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          if (dateInput) dateInput.value = `${yyyy}-${mm}-${dd}`;
        } else {
          if (customDateWrap) {
            customDateWrap.classList.remove('hidden');
            dateInput?.focus();
          }
        }
        updateSummaryHeader();
      });
    });

    // Custom date picker input change
    const dateInput = document.getElementById('book-tour-date');
    if (dateInput) {
      dateInput.addEventListener('change', () => {
        updateSummaryHeader();
      });
    }

    // Promo code apply button
    const btnApplyPromo = document.getElementById('btn-apply-promo');
    const promoInput = document.getElementById('promo-code-input');
    if (btnApplyPromo && promoInput) {
      btnApplyPromo.addEventListener('click', () => {
        applyPromoCode(promoInput.value.trim().toUpperCase());
      });
      promoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyPromoCode(promoInput.value.trim().toUpperCase());
        }
      });
    }

    // Payment Methods selection
    const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    paymentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        selectedPayment = e.target.value;
        updatePaymentCardStyles();
        const qrBox = document.getElementById('vietqr-box');
        if (qrBox) {
          if (selectedPayment === 'vietqr') {
            qrBox.classList.remove('hidden');
          } else {
            qrBox.classList.add('hidden');
          }
        }
      });
    });

    // Form Submit Button
    const bookingForm = document.getElementById('booking-direct-form');
    if (bookingForm) {
      bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitBookingForm();
      });
    }

    // Modal Copy Zalo Button
    const btnCopyZalo = document.getElementById('btn-copy-zalo-msg');
    if (btnCopyZalo) {
      btnCopyZalo.addEventListener('click', copyZaloMessage);
    }

    // Modal Close Button & Backdrop click
    const btnCloseModal = document.getElementById('btn-close-booking-modal');
    const bookingModal = document.getElementById('booking-success-modal');
    if (btnCloseModal && bookingModal) {
      btnCloseModal.addEventListener('click', closeSuccessModal);
    }
    if (bookingModal) {
      bookingModal.addEventListener('click', (e) => {
        if (e.target === bookingModal) closeSuccessModal();
      });
    }
  }

  function closeSuccessModal() {
    const bookingModal = document.getElementById('booking-success-modal');
    if (!bookingModal) return;
    bookingModal.classList.remove('active');
    setTimeout(() => bookingModal.classList.add('hidden'), 250);
  }

  function updatePaymentCardStyles() {
    const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    paymentRadios.forEach(radio => {
      const card = radio.closest('label');
      if (!card) return;
      if (radio.checked) {
        card.classList.add('selected', 'border-primary', 'bg-primary-fixed/20');
        card.classList.remove('border-outline-variant/40', 'bg-surface-container-low');
      } else {
        card.classList.remove('selected', 'border-primary', 'bg-primary-fixed/20');
        card.classList.add('border-outline-variant/40', 'bg-surface-container-low');
      }
    });
  }

  function applyPromoCode(code) {
    const feedback = document.getElementById('promo-feedback');
    if (!code) {
      if (feedback) feedback.textContent = "Vui lòng nhập mã giảm giá";
      return;
    }
    const promos = window.CO_TU_DATA?.promoCodes || {};
    if (promos[code]) {
      appliedPromo = { code: code, ...promos[code] };
      if (feedback) {
        feedback.className = "text-xs text-tertiary font-semibold flex items-center gap-1 mt-1.5";
        feedback.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span> Áp dụng thành công: ${appliedPromo.label}`;
      }
      showToastNotification(`Áp dụng mã ${code} thành công!`, 'success');
    } else {
      appliedPromo = null;
      if (feedback) {
        feedback.className = "text-xs text-secondary font-semibold flex items-center gap-1 mt-1.5";
        feedback.innerHTML = `<span class="material-symbols-outlined text-[16px]">error</span> Mã không tồn tại hoặc hết hạn. Thử: TIKTOK50, HEMSAIGON, COTU2026`;
      }
      showToastNotification('Mã giảm giá không hợp lệ', 'error');
    }
    updateCalculation();
  }

  function updateCalculation() {
    const totalGuests = adults + children;
    
    // Counter displays
    const adultDisplay = document.getElementById('adult-count-display');
    const childDisplay = document.getElementById('child-count-display');
    if (adultDisplay) adultDisplay.textContent = adults;
    if (childDisplay) childDisplay.textContent = children;

    // Subtotals
    const adultSubtotal = adults * ADULT_PRICE;
    const childSubtotal = children * CHILD_PRICE;
    const rawTotal = adultSubtotal + childSubtotal;

    // Discount
    let discountAmount = 0;
    if (appliedPromo) {
      if (appliedPromo.type === 'fixed') {
        discountAmount = appliedPromo.discount;
      } else if (appliedPromo.type === 'percent') {
        discountAmount = Math.round(rawTotal * appliedPromo.discount);
      }
      if (discountAmount > rawTotal) discountAmount = rawTotal;
    }

    const finalTotal = Math.max(0, rawTotal - discountAmount);

    // Update Summary Card elements
    const summaryAdults = document.getElementById('summary-adult-calc');
    const summaryChildren = document.getElementById('summary-child-calc');
    const summaryRaw = document.getElementById('summary-raw-total');
    const summaryDiscountRow = document.getElementById('summary-discount-row');
    const summaryDiscount = document.getElementById('summary-discount-amount');
    const summaryFinal = document.getElementById('summary-final-total');
    const floatingBarPrice = document.getElementById('floating-bar-price');
    const floatingBarGuests = document.getElementById('floating-bar-guests');

    if (summaryAdults) summaryAdults.textContent = `${adults} x ${ADULT_PRICE.toLocaleString('vi-VN')}₫ = ${adultSubtotal.toLocaleString('vi-VN')}₫`;
    if (summaryChildren) {
      if (children > 0) {
        summaryChildren.parentElement.classList.remove('hidden');
        summaryChildren.textContent = `${children} x ${CHILD_PRICE.toLocaleString('vi-VN')}₫ = ${childSubtotal.toLocaleString('vi-VN')}₫`;
      } else {
        summaryChildren.parentElement.classList.add('hidden');
      }
    }
    if (summaryRaw) summaryRaw.textContent = `${rawTotal.toLocaleString('vi-VN')}₫`;

    if (summaryDiscountRow && summaryDiscount) {
      if (discountAmount > 0) {
        summaryDiscountRow.classList.remove('hidden');
        summaryDiscount.textContent = `-${discountAmount.toLocaleString('vi-VN')}₫`;
      } else {
        summaryDiscountRow.classList.add('hidden');
      }
    }

    if (summaryFinal) summaryFinal.textContent = `${finalTotal.toLocaleString('vi-VN')}₫`;
    if (floatingBarPrice) floatingBarPrice.textContent = `${finalTotal.toLocaleString('vi-VN')}₫`;
    if (floatingBarGuests) floatingBarGuests.textContent = `${totalGuests} khách`;

    // Large Group Warning (>8 people)
    const warningEl = document.getElementById('group-capacity-warning');
    if (warningEl) {
      if (totalGuests > 8) {
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }
    }

    updateSummaryHeader();
  }

  function updateSummaryHeader() {
    const summaryDateEl = document.getElementById('summary-tour-date');
    const dateInput = document.getElementById('book-tour-date');
    if (summaryDateEl && dateInput) {
      const val = dateInput.value;
      if (val) {
        const parts = val.split('-');
        if (parts.length === 3) {
          summaryDateEl.textContent = `${parts[2]}/${parts[1]}/${parts[0]} lúc 16:30`;
        }
      }
    }
  }

  function startCountdown() {
    const minEl = document.getElementById('timer-min');
    const secEl = document.getElementById('timer-sec');
    if (!minEl || !secEl) return;

    if (countdownTimer.interval) clearInterval(countdownTimer.interval);

    countdownTimer.interval = setInterval(() => {
      if (countdownTimer.sec > 0) {
        countdownTimer.sec--;
      } else {
        if (countdownTimer.min > 0) {
          countdownTimer.min--;
          countdownTimer.sec = 59;
        } else {
          countdownTimer.min = 25;
          countdownTimer.sec = 0;
        }
      }
      minEl.textContent = String(countdownTimer.min).padStart(2, '0');
      secEl.textContent = String(countdownTimer.sec).padStart(2, '0');
    }, 1000);
  }

  function submitBookingForm() {
    const nameInput = document.getElementById('book-cust-name');
    const phoneInput = document.getElementById('book-cust-phone');
    const emailInput = document.getElementById('book-cust-email');
    const dateInput = document.getElementById('book-tour-date');
    const noteInput = document.getElementById('book-cust-notes');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const date = dateInput ? dateInput.value : '';
    const note = noteInput ? noteInput.value.trim() : '';

    // Validations
    if (!name || name.length < 2) {
      showToastNotification('Dạ phiền bạn điền đầy đủ Họ và Tên nghen!', 'error');
      nameInput?.focus();
      return;
    }

    // Vietnamese phone number validation: normalize +84 / 84 / 0 prefixes cleanly
    const phoneRegex = /^0(?:3|5|7|8|9)\d{8}$/;
    const cleanPhone = window.AuthManager && window.AuthManager.normalizePhone
      ? window.AuthManager.normalizePhone(phone)
      : phone.replace(/[\s.-]/g, '').replace(/^(?:\+?84)/, '0');
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      showToastNotification('Số điện thoại chưa hợp lệ (cần 10 chữ số, vd: 0912 345 678)', 'error');
      phoneInput?.focus();
      return;
    }

    // Email validation if entered
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToastNotification('Email chưa đúng định dạng (vd: name@gmail.com)', 'error');
        emailInput?.focus();
        return;
      }
    }

    // Date validation
    if (!date) {
      showToastNotification('Vui lòng chọn ngày đi tour', 'error');
      return;
    }

    // Collect dietary allergies
    const allergyChecked = [...document.querySelectorAll('input[name="dietary_pref"]:checked')].map(cb => cb.value);
    const allergiesStr = allergyChecked.length > 0 ? allergyChecked.join(', ') : 'Ăn được tất cả';

    // Calculate totals
    const totalGuests = adults + children;
    const finalPriceText = document.getElementById('summary-final-total')?.textContent || '590.000₫';
    const discountText = appliedPromo ? document.getElementById('summary-discount-amount')?.textContent || '0₫' : '0₫';

    // Format Date string: DD/MM/YYYY
    let formattedDate = date;
    const p = date.split('-');
    if (p.length === 3) {
      formattedDate = `${p[2]}/${p[1]}/${p[0]}`;
    }

    // Generate collision-free Booking ID
    let existingOrders = [];
    try {
      const stored = localStorage.getItem('co_tu_orders');
      existingOrders = stored ? JSON.parse(stored) : (window.CO_TU_DATA?.initialOrders || []);
    } catch (_) {
      existingOrders = window.CO_TU_DATA?.initialOrders || [];
    }
    let orderId;
    do {
      orderId = `CT-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (Array.isArray(existingOrders) && existingOrders.some(o => o && o.id === orderId));
    const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;

    const newOrder = {
      id: orderId,
      userId: currentUser ? currentUser.id : null,
      name: name,
      phone: cleanPhone,
      email: email || 'Chưa cung cấp',
      tourDate: formattedDate,
      tourTime: '16:30',
      date: `${formattedDate} lúc 16:30`,
      guests: totalGuests,
      adults: adults,
      children: children,
      total: finalPriceText,
      discount: discountText,
      payment: selectedPayment.toUpperCase(),
      status: "Đã xác nhận",
      dietary: allergiesStr,
      notes: note || 'Không có ghi chú thêm',
      createdAt: new Date().toISOString()
    };

    // Save to LocalStorage & Sync to Server
    saveOrder(newOrder);

    // Populate Success Modal
    populateSuccessModal(newOrder);

    // Open Modal
    const modal = document.getElementById('booking-success-modal');
    if (modal) {
      modal.classList.remove('hidden');
      setTimeout(() => modal.classList.add('active'), 10);
    }

    showToastNotification(`Đặt chỗ thành công! Mã đơn: ${orderId}`, 'success');
  }

  function saveOrder(order) {
    let orders = [];
    try {
      const stored = localStorage.getItem('co_tu_orders');
      if (stored) {
        orders = JSON.parse(stored);
      } else {
        orders = [...(window.CO_TU_DATA?.initialOrders || [])];
      }
    } catch (e) {
      orders = [...(window.CO_TU_DATA?.initialOrders || [])];
    }

    orders.unshift(order);
    try {
      localStorage.setItem('co_tu_orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }

    const auth = window.AuthManager;
    const isOnlineSync = !!(auth && auth.isHttpOrigin && auth.isHttpOrigin() && auth.apiRequest);

    // Log customer action in AuthManager
    let act = null;
    if (auth) {
      act = auth.logActivity(
        'Đặt tour trực tiếp',
        `Khách ${order.name} (${order.phone}) đặt tour ngày ${order.tourDate} (${order.guests} khách). Tổng tiền: ${order.total}`,
        order.id,
        { localOnly: isOnlineSync }
      );
      if (auth.isCustomer && auth.isCustomer()) {
        auth.renderCustomerPortal();
      }
    }

    if (isOnlineSync && auth.sendMutation) {
      const currentUser = auth.getCurrentUser ? auth.getCurrentUser() : null;
      auth.sendMutation('POST', '/api/orders', {
        ...order,
        _activityId: act ? act.id : undefined,
        _actorName: currentUser ? currentUser.fullName : order.name,
        _actorRole: currentUser ? currentUser.role : 'guest'
      }, 'order-create');
    } else if (isOnlineSync && auth.nextMutationToken) {
      const mutToken = auth.nextMutationToken('order-create');
      const currentUser = auth.getCurrentUser ? auth.getCurrentUser() : null;
      auth.apiRequest('POST', '/api/orders', {
        ...order,
        _activityId: act ? act.id : undefined,
        _actorName: currentUser ? currentUser.fullName : order.name,
        _actorRole: currentUser ? currentUser.role : 'guest'
      }, { keepalive: true }).finally(() => {
        if (auth.finishMutationToken) auth.finishMutationToken(mutToken);
        if (auth.getPendingMutationCount && auth.getPendingMutationCount() === 0 && auth.isBackendAvailable && auth.isBackendAvailable()) {
          auth.syncFromServer({ source: 'order-created' });
        }
      });
    }

    // Update Admin dashboard if loaded
    if (window.AdminPortal) {
      window.AdminPortal.refreshOrders();
    }
  }

  // Pre-Booking Engine (Đặt Tour Trước / Tour Đoàn Riêng)
  function updatePrebookBudget() {
    const themeSelect = document.getElementById('prebook-theme');
    const guestsInput = document.getElementById('prebook-guests');
    const budgetDisplay = document.getElementById('prebook-estimated-budget');
    if (!guestsInput || !budgetDisplay) return;
    let g = parseInt(guestsInput.value, 10);
    if (isNaN(g) || g < 1) g = 2;
    if (g > 30) {
      g = 30;
      guestsInput.value = '30';
    }
    let price = 590000;
    if (themeSelect && themeSelect.value) {
      const themes = window.CO_TU_DATA?.preBookingThemes || [];
      const th = themes.find(t => t.id === themeSelect.value);
      if (th && th.pricePerPax) price = th.pricePerPax;
    }
    const total = g * price;
    budgetDisplay.textContent = `${total.toLocaleString('vi-VN')}₫`;
    updatePrebookSummary();
  }

  function initPreBooking() {
    const formPrebook = document.getElementById('form-prebook-tour');
    const themeSelect = document.getElementById('prebook-theme');
    const guestsInput = document.getElementById('prebook-guests');
    const dateInput = document.getElementById('prebook-date');
    const slotSelect = document.getElementById('prebook-timeslot');

    if (guestsInput) guestsInput.addEventListener('input', updatePrebookBudget);
    if (themeSelect) themeSelect.addEventListener('change', updatePrebookBudget);
    if (dateInput) dateInput.addEventListener('change', updatePrebookSummary);
    if (slotSelect) slotSelect.addEventListener('change', updatePrebookSummary);

    if (formPrebook) {
      formPrebook.addEventListener('submit', (e) => {
        e.preventDefault();
        submitPreBookingForm();
      });
    }

    // Set default min date for prebook: today
    if (dateInput) {
      const now = new Date();
      const todayY = now.getFullYear();
      const todayM = String(now.getMonth() + 1).padStart(2, '0');
      const todayD = String(now.getDate()).padStart(2, '0');
      dateInput.min = `${todayY}-${todayM}-${todayD}`;
    }

    updatePrebookBudget();
  }

  function updatePrebookSummary() {
    const themeSelect = document.getElementById('prebook-theme');
    const dateInput = document.getElementById('prebook-date');
    const slotSelect = document.getElementById('prebook-timeslot');
    const guestsInput = document.getElementById('prebook-guests');
    const budgetDisplay = document.getElementById('prebook-estimated-budget');

    const sumTheme = document.getElementById('prebook-summary-theme');
    const sumDate = document.getElementById('prebook-summary-date');
    const sumSlot = document.getElementById('prebook-summary-slot');
    const sumGuests = document.getElementById('prebook-summary-guests');
    const sumBudget = document.getElementById('prebook-summary-budget');

    if (sumTheme && themeSelect) {
      const themes = window.CO_TU_DATA?.preBookingThemes || [];
      const th = themes.find(t => t.id === themeSelect.value);
      sumTheme.textContent = th ? th.name : (themeSelect.options[themeSelect.selectedIndex]?.text || 'Hẻm Ẩm Thực Toàn Diện 5 Trạm');
    }

    if (sumDate && dateInput) {
      const val = dateInput.value;
      if (val) {
        const p = val.split('-');
        sumDate.textContent = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : val;
      } else {
        sumDate.textContent = 'Chưa chọn ngày';
      }
    }

    if (sumSlot && slotSelect) {
      sumSlot.textContent = slotSelect.value;
    }

    if (sumGuests && guestsInput) {
      const g = parseInt(guestsInput.value, 10) || 2;
      sumGuests.textContent = `${g} khách`;
    }

    if (sumBudget && budgetDisplay) {
      sumBudget.textContent = budgetDisplay.textContent;
    }
  }

  function submitPreBookingForm() {
    const nameInput = document.getElementById('prebook-cust-name');
    const phoneInput = document.getElementById('prebook-cust-phone');
    const emailInput = document.getElementById('prebook-cust-email');
    const dateInput = document.getElementById('prebook-date');
    const slotSelect = document.getElementById('prebook-timeslot');
    const themeSelect = document.getElementById('prebook-theme');
    const guestsInput = document.getElementById('prebook-guests');
    const dietaryInput = document.getElementById('prebook-dietary');
    const requestsInput = document.getElementById('prebook-requests');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const date = dateInput ? dateInput.value : '';
    const slot = slotSelect ? slotSelect.value : '16:30 (Chiều mát)';
    
    let theme = 'Hẻm Ẩm Thực Toàn Diện 5 Trạm';
    if (themeSelect) {
      const themes = window.CO_TU_DATA?.preBookingThemes || [];
      const th = themes.find(t => t.id === themeSelect.value);
      theme = th ? th.name : (themeSelect.options[themeSelect.selectedIndex]?.text || themeSelect.value);
    }

    const guests = parseInt(guestsInput?.value, 10) || 2;
    const dietary = dietaryInput ? dietaryInput.value.trim() : 'Ăn được tất cả';
    const requests = requestsInput ? requestsInput.value.trim() : '';

    if (!name || name.length < 2) {
      showToastNotification('Vui lòng nhập họ và tên của bạn!', 'error');
      nameInput?.focus();
      return;
    }

    const phoneRegex = /^0(?:3|5|7|8|9)\d{8}$/;
    const cleanPhone = window.AuthManager && window.AuthManager.normalizePhone
      ? window.AuthManager.normalizePhone(phone)
      : phone.replace(/[\s.-]/g, '').replace(/^(?:\+?84)/, '0');
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      showToastNotification('Số điện thoại chưa hợp lệ (cần 10 chữ số, ví dụ 0912 345 678)', 'error');
      phoneInput?.focus();
      return;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToastNotification('Email chưa đúng định dạng!', 'error');
        emailInput?.focus();
        return;
      }
    }

    if (!date) {
      showToastNotification('Vui lòng chọn ngày mong muốn khởi hành tour!', 'error');
      dateInput?.focus();
      return;
    }

    let formattedDate = date;
    const p = date.split('-');
    if (p.length === 3) formattedDate = `${p[2]}/${p[1]}/${p[0]}`;

    const budgetDisplay = document.getElementById('prebook-estimated-budget');
    const budget = budgetDisplay ? budgetDisplay.textContent : `${guests * 590000}₫`;
    const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;

    if (window.AuthManager) {
      const preOrder = window.AuthManager.savePreBooking({
        userId: currentUser ? currentUser.id : null,
        customerName: name,
        phone: cleanPhone,
        email: email,
        targetDate: formattedDate,
        timeSlot: slot,
        theme: theme,
        guests: guests,
        estimatedBudget: budget,
        dietaryNotes: dietary,
        specialRequests: requests
      });

      showToastNotification(`Đã gửi yêu cầu Đặt Tour Trước thành công! Mã yêu cầu: ${preOrder.id}. Cô Tư sẽ liên hệ bạn sớm nhất!`, 'success');

      document.getElementById('form-prebook-tour')?.reset();
      updatePrebookBudget();
      autoFillUserBookingInfo();

      if (window.AdminPortal) window.AdminPortal.refreshOrders();
    }
  }

  function populateSuccessModal(order) {
    const idEl = document.getElementById('modal-ticket-id');
    const nameEl = document.getElementById('modal-ticket-name');
    const phoneEl = document.getElementById('modal-ticket-phone');
    const dateEl = document.getElementById('modal-ticket-date');
    const guestsEl = document.getElementById('modal-ticket-guests');
    const totalEl = document.getElementById('modal-ticket-total');
    const paymentEl = document.getElementById('modal-ticket-payment');
    const dietaryEl = document.getElementById('modal-ticket-dietary');
    const zaloMsgEl = document.getElementById('modal-zalo-msg');

    if (idEl) idEl.textContent = order.id;
    if (nameEl) nameEl.textContent = order.name;
    if (phoneEl) phoneEl.textContent = order.phone;
    if (dateEl) dateEl.textContent = `${order.tourDate} lúc 16:30`;
    if (guestsEl) guestsEl.textContent = `${order.guests} khách (${order.adults} người lớn, ${order.children} trẻ em)`;
    if (totalEl) totalEl.textContent = order.total;
    if (paymentEl) paymentEl.textContent = order.payment;
    if (dietaryEl) dietaryEl.textContent = order.dietary;

    // Fixed Zalo template without the "ngày Hôm / ngày Ngày" split bug!
    const zaloTemplate = `Dạ Cô Tư chào ${order.name}!
Mã giữ chỗ tour Hẻm của bạn là *${order.id}* (${order.guests} khách).
Hẹn bạn lúc 16:30 ngày ${order.tourDate} tại điểm hẹn: Hẻm 150 Nguyễn Đình Chiểu, P. Đa Kao, Q.1.
Lưu ý ăn uống: ${order.dietary}.
Hotline hỗ trợ khẩn cấp: 0908 287 150. Hẹn gặp bạn tối nay nghen!`;

    if (zaloMsgEl) zaloMsgEl.textContent = zaloTemplate;
  }

  function copyZaloMessage() {
    const zaloMsgEl = document.getElementById('modal-zalo-msg');
    const btn = document.getElementById('btn-copy-zalo-msg');
    if (!zaloMsgEl) return;
    const text = zaloMsgEl.textContent || '';

    const markCopied = () => {
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">done</span> Đã Sao Chép Tin Nhắn!`;
        btn.classList.add('bg-tertiary', 'text-on-tertiary');
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('bg-tertiary', 'text-on-tertiary');
        }, 2000);
      }
      showToastNotification('Đã sao chép nội dung xác nhận!', 'success');
    };

    const execCopyFallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          markCopied();
        } else {
          showToastNotification('Nhấn Ctrl+C để sao chép tin nhắn', 'info');
        }
      } catch (e) {
        showToastNotification('Nhấn Ctrl+C để sao chép tin nhắn', 'info');
      }
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(markCopied).catch(execCopyFallback);
    } else {
      execCopyFallback();
    }
  }

  // Pre-fill from AI or external link with safety bounds
  function prefillBooking(data) {
    if (data.name) {
      const nameInput = document.getElementById('book-cust-name');
      if (nameInput) nameInput.value = data.name;
    }
    if (data.adults !== undefined) {
      adults = Math.min(16, Math.max(1, parseInt(data.adults, 10) || 1));
    }
    if (data.promo) {
      applyPromoCode(data.promo);
    }
    updateCalculation();

    // Scroll smoothly to booking section
    const bookSec = document.getElementById('section-book');
    if (bookSec) {
      bookSec.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function showToastNotification(msg, type) {
    if (window.AppController?.showToast) {
      window.AppController.showToast(msg, type);
    }
  }

  return {
    init,
    prefillBooking,
    applyPromoCode,
    updateCalculation,
    switchBookingMode,
    initPreBooking,
    submitPreBookingForm,
    autoFillUserBookingInfo,
    updatePrebookBudget,
    updatePrebookSummary
  };
})();
