/**
 * Main Application Controller for Cô Tư Alley Tour
 * Orchestrates Scrollspy, Search & Map Matrix, Reviews, Modals, and UI micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});

const AppController = (function() {
  let userBellyRating = 5;
  let currentFilterFlavor = 'all';
  let currentFilterDietary = 'all';
  let currentSearchQuery = '';
  let cachedNetworkInfo = null;
  let networkInfoState = 'idle'; // 'idle' | 'loading' | 'ready' | 'unavailable'
  let networkInfoPromise = null;

  function fetchNetworkInfo(force = false) {
    if (typeof window === 'undefined' || !window.location || !/^https?:$/i.test(window.location.protocol)) {
      networkInfoState = 'unavailable';
      return Promise.resolve(null);
    }
    if (networkInfoPromise && !force) return networkInfoPromise;
    networkInfoState = 'loading';
    const requester = (window.AuthManager && window.AuthManager.apiRequest)
      ? window.AuthManager.apiRequest('GET', '/api/network-info')
      : fetch('/api/network-info', { cache: 'no-store' })
          .then(async (r) => {
            const ct = r.headers.get('content-type') || '';
            if (!r.ok || !ct.includes('application/json')) return { ok: false, data: null };
            return { ok: true, data: await r.json() };
          })
          .catch(() => ({ ok: false, data: null }));

    networkInfoPromise = requester.then((res) => {
      if (res && res.ok && res.data) {
        cachedNetworkInfo = res.data;
        networkInfoState = 'ready';
      } else {
        networkInfoState = 'unavailable';
      }
      renderReferralQR();
      return cachedNetworkInfo;
    }).catch(() => {
      networkInfoState = 'unavailable';
      renderReferralQR();
      return null;
    });
    return networkInfoPromise;
  }

  function init() {
    fetchNetworkInfo();
    setupUTMBanner();
    setupMobileMenu();
    setupScrollspy();
    setupSearchAndFilters();
    setupMapInteractions();
    setupFAQAccordions();
    setupReviewSystem();
    setupSecretTipModal();
    setupCustomerPortalModalTabs();
    setupReferralQRModal();
    setupBackdropDismissals();

    // Discreet administrator shortcut (Ctrl+Shift+A) without exposing admin links in customer UI
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
          e.preventDefault();
          window.location.href = 'admin-login.html';
        }
      });
    }

    // Initialize sub-modules (Auth first so roles & session exist)
    if (window.AuthManager) {
      window.AuthManager.init();
      window.AuthManager.onAuthStateChanged(() => {
        if (window.BookingEngine?.autoFillUserBookingInfo) {
          window.BookingEngine.autoFillUserBookingInfo();
        }
      });
    }
    if (window.BookingEngine) window.BookingEngine.init();
    if (window.AICoTu) window.AICoTu.init();
  }

  // Customer Portal Modal Tabs & Actions
  function setupCustomerPortalModalTabs() {
    const tabButtons = document.querySelectorAll('.cust-nav-tab-btn');
    const tabPanels = document.querySelectorAll('.cust-tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        tabButtons.forEach(b => {
          if (b === btn) {
            b.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
            b.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
          } else {
            b.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
            b.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
          }
        });

        tabPanels.forEach(panel => {
          if (panel.id === `cust-panel-${tab}`) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }
        });

        if (window.AuthManager) {
          window.AuthManager.renderCustomerPortal();
        }
      });
    });

    // Profile form submit
    const profileForm = document.getElementById('form-customer-profile');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('cust-profile-fullname')?.value;
        const phone = document.getElementById('cust-profile-phone')?.value;
        const dietary = document.getElementById('cust-profile-dietary')?.value;

        if (window.AuthManager) {
          const submitBtn = profileForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          try {
            const updater = window.AuthManager.updateCustomerProfileAsync || window.AuthManager.updateCustomerProfile;
            const res = await updater({ fullName, phone, dietary });
            if (res.success) {
              showToast(res.message, 'success');
            } else {
              showToast(res.message, 'error');
            }
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        }
      });
    }

    // Voucher apply buttons in portal
    document.querySelectorAll('.btn-apply-portal-voucher').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        if (code && window.BookingEngine) {
          window.BookingEngine.applyPromoCode(code);
          if (window.AuthManager) window.AuthManager.closeCustomerPortalModal();
          showToast(`Đã áp dụng mã ưu đãi ${code}!`, 'success');
          const bookSec = document.getElementById('section-book');
          if (bookSec) bookSec.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'error') iconName = 'error';

    toast.innerHTML = `
      <span class="material-symbols-outlined text-[20px] shrink-0">${iconName}</span>
      <span class="flex-1 leading-snug">${escapeHTML(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // 1. UTM Dynamic Campaign Banner
  function setupUTMBanner() {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const banner = document.getElementById('utm-banner');
    const bannerText = document.getElementById('utm-text');
    const btnDismiss = document.getElementById('btn-dismiss-utm');

    if (utmSource && bannerText) {
      const src = utmSource.toLowerCase();
      if (src.includes('tiktok')) {
        bannerText.innerHTML = `Chào bạn ghé từ kênh <strong>TikTok</strong>! Nhận ưu đãi mã đặc quyền <strong>'TIKTOK50'</strong> giảm ngay 50.000₫ khi đi tour tối nay!`;
        if (window.BookingEngine) window.BookingEngine.applyPromoCode('TIKTOK50');
      } else if (src.includes('facebook') || src.includes('fb')) {
        bannerText.innerHTML = `Chào thực khách từ <strong>Facebook</strong>! Cô Tư dành riêng chỗ ngồi view bếp củi Đa Kao và tặng mã <strong>'HEMSAIGON'</strong> (giảm 10%) cho bạn.`;
        if (window.BookingEngine) window.BookingEngine.applyPromoCode('HEMSAIGON');
      } else if (src.includes('insta')) {
        bannerText.innerHTML = `Chào bạn từ <strong>Instagram</strong>! Chuyến đi tối nay có photographer bản địa chụp ảnh ngõ hẻm tặng bạn miễn phí!`;
      }
    }

    if (btnDismiss && banner) {
      btnDismiss.addEventListener('click', () => {
        banner.style.display = 'none';
      });
    }
  }

  // 2. Mobile Hamburger Menu & Slide-out Navigation Drawer
  function setupMobileMenu() {
    const btnToggle = document.getElementById('btn-mobile-menu-toggle');
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    const btnClose = document.getElementById('btn-close-mobile-nav');
    const navLinks = document.querySelectorAll('.mobile-nav-link');

    const openDrawer = () => {
      if (!mobileDrawer) return;
      mobileDrawer.classList.remove('hidden');
      setTimeout(() => mobileDrawer.classList.add('active'), 10);
    };

    const closeDrawer = () => {
      if (!mobileDrawer) return;
      mobileDrawer.classList.remove('active');
      setTimeout(() => mobileDrawer.classList.add('hidden'), 250);
    };

    if (btnToggle && mobileDrawer) {
      btnToggle.addEventListener('click', openDrawer);
    }
    if (btnClose) btnClose.addEventListener('click', closeDrawer);
    navLinks.forEach(link => link.addEventListener('click', closeDrawer));

    // Dismiss drawer when clicking outside content box
    if (mobileDrawer) {
      mobileDrawer.addEventListener('click', (e) => {
        if (e.target === mobileDrawer) closeDrawer();
      });
    }
  }

  // 3. Sticky Journey Tracker & Scrollspy (True Document-Relative Coordinates)
  function setupScrollspy() {
    const sections = [
      { id: 'section-see', navId: 'journey-node-see' },
      { id: 'section-search', navId: 'journey-node-search' },
      { id: 'section-compare', navId: 'journey-node-compare' },
      { id: 'section-book', navId: 'journey-node-book' },
      { id: 'section-experience', navId: 'journey-node-experience' },
      { id: 'section-review', navId: 'journey-node-review' }
    ];

    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 240;
      let activeIndex = 0;

      sections.forEach((sec, idx) => {
        const el = document.getElementById(sec.id);
        if (el) {
          const docTop = window.scrollY + el.getBoundingClientRect().top;
          if (scrollPos >= docTop) {
            activeIndex = idx;
          }
        }
      });

      sections.forEach((sec, idx) => {
        const navEl = document.getElementById(sec.navId);
        if (!navEl) return;

        const badge = navEl.querySelector('.node-step-badge');

        if (idx < activeIndex) {
          // Completed step: Fresh Herb Green
          navEl.className = "journey-node flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant transition-all font-semibold text-xs sm:text-sm";
          if (badge) {
            badge.className = "node-step-badge w-5 h-5 rounded-full flex items-center justify-center bg-tertiary text-on-tertiary text-xs font-bold";
            badge.innerHTML = "✓";
          }
        } else if (idx === activeIndex) {
          // Active current step: Turmeric Gold
          navEl.className = "journey-node flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container transition-all font-bold text-xs sm:text-sm shadow-md scale-105";
          if (badge) {
            badge.className = "node-step-badge w-5 h-5 rounded-full flex items-center justify-center bg-on-primary-container/20 text-on-primary-container text-xs font-bold";
            badge.textContent = idx + 1;
          }
        } else {
          // Pending step
          navEl.className = "journey-node flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant transition-all font-medium text-xs sm:text-sm hover:bg-surface-container-high";
          if (badge) {
            badge.className = "node-step-badge w-5 h-5 rounded-full flex items-center justify-center bg-surface-variant text-on-surface-variant text-xs font-bold";
            badge.textContent = idx + 1;
          }
        }
      });
    }, { passive: true });
  }

  // 4. Search & Multi-criteria Filtering
  function setupSearchAndFilters() {
    const searchInput = document.getElementById('search-alley-input');
    const flavorChips = document.querySelectorAll('.filter-flavor-chip');
    const dietaryChips = document.querySelectorAll('.filter-dietary-chip');
    const resetBtn = document.getElementById('btn-reset-stops-filter');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        filterStopsList();
      });
    }

    flavorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        flavorChips.forEach(c => {
          c.classList.remove('bg-secondary', 'text-on-secondary');
          c.classList.add('bg-surface-container', 'text-on-surface');
        });
        chip.classList.add('bg-secondary', 'text-on-secondary');
        chip.classList.remove('bg-surface-container', 'text-on-surface');
        currentFilterFlavor = chip.getAttribute('data-flavor');
        filterStopsList();
      });
    });

    dietaryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dietaryChips.forEach(c => {
          c.classList.remove('bg-tertiary', 'text-on-tertiary');
          c.classList.add('bg-surface-container', 'text-on-surface');
        });
        chip.classList.add('bg-tertiary', 'text-on-tertiary');
        chip.classList.remove('bg-surface-container', 'text-on-surface');
        currentFilterDietary = chip.getAttribute('data-dietary');
        filterStopsList();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', resetAllFilters);
    }
  }

  function resetAllFilters() {
    currentSearchQuery = '';
    currentFilterFlavor = 'all';
    currentFilterDietary = 'all';

    const searchInput = document.getElementById('search-alley-input');
    if (searchInput) searchInput.value = '';

    const flavorChips = document.querySelectorAll('.filter-flavor-chip');
    flavorChips.forEach(c => {
      if (c.getAttribute('data-flavor') === 'all') {
        c.classList.add('bg-secondary', 'text-on-secondary');
        c.classList.remove('bg-surface-container', 'text-on-surface');
      } else {
        c.classList.remove('bg-secondary', 'text-on-secondary');
        c.classList.add('bg-surface-container', 'text-on-surface');
      }
    });

    const dietaryChips = document.querySelectorAll('.filter-dietary-chip');
    dietaryChips.forEach(c => {
      if (c.getAttribute('data-dietary') === 'all') {
        c.classList.add('bg-tertiary', 'text-on-tertiary');
        c.classList.remove('bg-surface-container', 'text-on-surface');
      } else {
        c.classList.remove('bg-tertiary', 'text-on-tertiary');
        c.classList.add('bg-surface-container', 'text-on-surface');
      }
    });

    filterStopsList();
    showToast('Đã đặt lại bộ lọc món ăn!', 'info');
  }

  function filterStopsList() {
    const stopCards = document.querySelectorAll('.stop-timeline-card');
    let visibleCount = 0;
    const matchingStopIds = new Set();

    stopCards.forEach(card => {
      const name = card.getAttribute('data-stop-name')?.toLowerCase() || '';
      const district = card.getAttribute('data-district')?.toLowerCase() || '';
      const desc = card.getAttribute('data-desc')?.toLowerCase() || '';
      const flavor = card.getAttribute('data-flavor') || '';
      const dietary = card.getAttribute('data-dietary') || '';
      const stopId = card.id?.replace('stop-card-', '');

      const matchSearch = !currentSearchQuery || 
                          name.includes(currentSearchQuery) || 
                          district.includes(currentSearchQuery) || 
                          desc.includes(currentSearchQuery);

      const matchFlavor = currentFilterFlavor === 'all' || flavor === currentFilterFlavor;
      const matchDietary = currentFilterDietary === 'all' || dietary.includes(currentFilterDietary);

      if (matchSearch && matchFlavor && matchDietary) {
        card.style.display = 'grid';
        visibleCount++;
        if (stopId) matchingStopIds.add(stopId);
      } else {
        card.style.display = 'none';
      }
    });

    // Synchronize Map Pins with search state!
    const pins = document.querySelectorAll('.map-stop-pin');
    pins.forEach(pin => {
      const pinId = pin.getAttribute('data-stop-id');
      if (matchingStopIds.has(pinId)) {
        pin.classList.remove('dimmed');
      } else {
        pin.classList.add('dimmed');
      }
    });

    const noResultMsg = document.getElementById('no-stops-found-msg');
    if (noResultMsg) {
      if (visibleCount === 0) {
        noResultMsg.classList.remove('hidden');
      } else {
        noResultMsg.classList.add('hidden');
      }
    }
  }

  // 5. Map Pin Highlights
  function setupMapInteractions() {
    const pins = document.querySelectorAll('.map-stop-pin');
    pins.forEach(pin => {
      pin.addEventListener('click', () => {
        const stopId = pin.getAttribute('data-stop-id');
        const targetCard = document.getElementById(`stop-card-${stopId}`);

        // If card is hidden due to current filters, reset filters first!
        if (targetCard && targetCard.style.display === 'none') {
          resetAllFilters();
        }

        pins.forEach(p => p.classList.remove('active', 'scale-105'));
        pin.classList.add('active', 'scale-105');

        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.classList.add('ring-4', 'ring-primary-container');
          setTimeout(() => targetCard.classList.remove('ring-4', 'ring-primary-container'), 1800);
        }
      });
    });
  }

  // 6. FAQ Accordion
  function setupFAQAccordions() {
    const items = document.querySelectorAll('.faq-accordion-item');
    items.forEach(item => {
      const btn = item.querySelector('.faq-accordion-btn');
      const content = item.querySelector('.faq-accordion-content');
      const icon = item.querySelector('.faq-icon');

      if (btn && content) {
        btn.addEventListener('click', () => {
          const isOpen = !content.classList.contains('hidden');
          // Close other open accordions
          items.forEach(other => {
            other.querySelector('.faq-accordion-content')?.classList.add('hidden');
            const otherIcon = other.querySelector('.faq-icon');
            if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
          });

          if (!isOpen) {
            content.classList.remove('hidden');
            if (icon) icon.style.transform = 'rotate(180deg)';
          }
        });
      }
    });
  }

  // 7. Interactive Review System
  function setupReviewSystem() {
    const starBtns = document.querySelectorAll('.belly-star-btn');
    const moodBadge = document.getElementById('belly-mood-badge');
    const submitBtn = document.getElementById('btn-submit-review');
    const reviewContent = document.getElementById('user-review-text');
    const reviewAuthor = document.getElementById('user-review-author');
    const reviewRole = document.getElementById('user-review-role');
    const reviewsFeed = document.getElementById('live-reviews-feed');

    const ratingsMap = [
      { label: "1 / 5 - Đói meo, chưa đúng gu", star: 1 },
      { label: "2 / 5 - Tạm ổn, cần đậm đà hơn", star: 2 },
      { label: "3 / 5 - Vừa bụng, tròn vị", star: 3 },
      { label: "4 / 5 - Rất ngon, đậm chất hẻm!", star: 4 },
      { label: "5 / 5 - No nê quên lối về, xuất sắc!", star: 5 }
    ];

    function updateStarsDisplay(val) {
      starBtns.forEach(s => {
        const sVal = parseInt(s.getAttribute('data-star'), 10);
        const icon = s.querySelector('.material-symbols-outlined');
        if (icon) {
          if (sVal <= val) {
            icon.classList.remove('text-outline-variant');
            icon.classList.add('text-primary-container', 'fill-1');
          } else {
            icon.classList.remove('text-primary-container', 'fill-1');
            icon.classList.add('text-outline-variant');
          }
        }
      });
    }

    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const starVal = parseInt(btn.getAttribute('data-star'), 10);
        userBellyRating = starVal;

        if (moodBadge && ratingsMap[starVal - 1]) {
          moodBadge.textContent = ratingsMap[starVal - 1].label;
          moodBadge.classList.add('scale-105');
          setTimeout(() => moodBadge.classList.remove('scale-105'), 180);
        }
        updateStarsDisplay(starVal);
      });

      // Hover feedback
      btn.addEventListener('mouseenter', () => {
        const hoverVal = parseInt(btn.getAttribute('data-star'), 10);
        updateStarsDisplay(hoverVal);
      });
      btn.addEventListener('mouseleave', () => {
        updateStarsDisplay(userBellyRating);
      });
    });

    // Map role text to category filter value
    function mapRoleToCategory(roleText) {
      const lower = roleText.toLowerCase();
      if (lower.includes('người yêu') || lower.includes('cặp đôi')) return 'couple';
      if (lower.includes('nhóm') || lower.includes('gia đình')) return 'group';
      if (lower.includes('quốc tế') || lower.includes('nước ngoài')) return 'foreigner';
      return 'solo';
    }

    // Submit Review
    if (submitBtn && reviewContent) {
      submitBtn.addEventListener('click', () => {
        const text = reviewContent.value.trim();
        const author = (reviewAuthor ? reviewAuthor.value.trim() : '') || 'Thực khách yêu hẻm';
        const role = reviewRole ? reviewRole.value : 'Khách đi một mình';
        const category = mapRoleToCategory(role);

        if (!text) {
          showToast('Bạn viết đôi dòng cảm nhận cho Cô Tư nghe nhé!', 'error');
          reviewContent.focus();
          return;
        }

        const newReviewCard = document.createElement('div');
        newReviewCard.className = "review-item-card bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col justify-between transition-all hover:-translate-y-1";
        newReviewCard.setAttribute('data-cat', category);

        let starsHTML = '';
        for (let i = 0; i < 5; i++) {
          if (i < userBellyRating) {
            starsHTML += '<span class="material-symbols-outlined text-[18px] text-primary-container fill-1">star</span>';
          } else {
            starsHTML += '<span class="material-symbols-outlined text-[18px] text-outline-variant">star</span>';
          }
        }

        newReviewCard.innerHTML = `
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed font-bold flex items-center justify-center text-sm shadow-sm">
                  ${author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 class="font-bold text-on-surface text-sm sm:text-base">${escapeHTML(author)}</h4>
                  <span class="text-xs text-on-surface-variant">${escapeHTML(role)} • Vừa xong</span>
                </div>
              </div>
              <div class="flex items-center text-primary-container">
                ${starsHTML}
              </div>
            </div>
            <p class="text-on-surface text-sm leading-relaxed">${escapeHTML(text)}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
            <span class="inline-flex items-center gap-1 text-tertiary font-semibold">
              <span class="material-symbols-outlined text-[16px]">verified</span> Đã xác thực đặt tour
            </span>
            <button class="review-like-btn flex items-center gap-1 hover:text-secondary transition-colors" type="button">
              <span class="material-symbols-outlined text-[16px]">favorite</span>
              <span class="like-count">1</span>
            </button>
          </div>
        `;

        if (reviewsFeed) {
          reviewsFeed.prepend(newReviewCard);
          attachLikeListener(newReviewCard.querySelector('.review-like-btn'));
        }

        reviewContent.value = '';
        showToast('Cảm ơn bạn đã gửi ký ức lên tường ngõ hẻm!', 'success');

        // Certificate unlock celebration
        showCertificateModal(author);
      });
    }

    // Wall of memories category filter chips
    const memoryChips = document.querySelectorAll('.filter-memory-chip');
    memoryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        memoryChips.forEach(c => {
          c.classList.remove('bg-secondary', 'text-on-secondary');
          c.classList.add('bg-surface-container', 'text-on-surface');
        });
        chip.classList.add('bg-secondary', 'text-on-secondary');
        chip.classList.remove('bg-surface-container', 'text-on-surface');

        const cat = chip.getAttribute('data-category');
        document.querySelectorAll('.review-item-card').forEach(item => {
          if (cat === 'all' || item.getAttribute('data-cat') === cat) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });

    // Like buttons across reviews
    document.querySelectorAll('.review-like-btn').forEach(attachLikeListener);
  }

  function attachLikeListener(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const countEl = btn.querySelector('.like-count');
      const icon = btn.querySelector('.material-symbols-outlined');
      let currentLikes = parseInt(countEl?.textContent || '0', 10);
      if (!btn.classList.contains('text-secondary')) {
        btn.classList.add('text-secondary');
        if (icon) icon.classList.add('fill-1');
        if (countEl) countEl.textContent = currentLikes + 1;
      } else {
        btn.classList.remove('text-secondary');
        if (icon) icon.classList.remove('fill-1');
        if (countEl) countEl.textContent = Math.max(0, currentLikes - 1);
      }
    });
  }

  // 8. Commemorative Certificate Modal
  function showCertificateModal(name) {
    const certModal = document.getElementById('certificate-modal');
    const certName = document.getElementById('cert-traveler-name');
    const closeBtn = document.getElementById('btn-close-cert');

    if (certName) certName.textContent = name;
    if (certModal) {
      certModal.classList.remove('hidden');
      setTimeout(() => certModal.classList.add('active'), 10);
    }

    if (closeBtn && certModal) {
      closeBtn.addEventListener('click', () => {
        certModal.classList.remove('active');
        setTimeout(() => certModal.classList.add('hidden'), 250);
      });
    }
  }

  // 9. Secret Tip Modal
  function setupSecretTipModal() {
    const tipModal = document.getElementById('secret-tip-modal');
    const tipTitle = document.getElementById('modal-tip-title');
    const tipContent = document.getElementById('modal-tip-content');
    const closeBtn = document.getElementById('btn-close-tip-modal');

    document.querySelectorAll('.btn-open-secret-tip').forEach(btn => {
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-stop-name');
        const tip = btn.getAttribute('data-secret-tip');
        if (tipTitle) tipTitle.textContent = title;
        if (tipContent) tipContent.textContent = tip;
        if (tipModal) {
          tipModal.classList.remove('hidden');
          setTimeout(() => tipModal.classList.add('active'), 10);
        }
      });
    });

    if (closeBtn && tipModal) {
      closeBtn.addEventListener('click', () => {
        tipModal.classList.remove('active');
        setTimeout(() => tipModal.classList.add('hidden'), 250);
      });
    }
  }

  // 10. Customer Referral QR Code Modal (Mã QR Giới Thiệu Bạn Bè)
  function isLocalOrVirtualHost(hostname) {
    if (!hostname) return false;
    const h = hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h === '0.0.0.0') {
      return true;
    }
    if (cachedNetworkInfo && Array.isArray(cachedNetworkInfo.filteredVirtual)) {
      if (cachedNetworkInfo.filteredVirtual.some(v => v && v.address === h)) return true;
    }
    if (/^192\.168\.(?:133|255)\.\d+$/.test(h)) return true;
    return false;
  }

  function getReferralUrl() {
    if (typeof window === 'undefined' || !window.location) return 'https://cotu-saigon.vn';
    if (window.location.protocol === 'file:') {
      return 'https://cotu-saigon.vn';
    }
    const pathClean = (window.location.pathname || '/').replace(/index\.html$/, '');
    if (isLocalOrVirtualHost(window.location.hostname) && cachedNetworkInfo && cachedNetworkInfo.primaryLanUrl) {
      return cachedNetworkInfo.primaryLanUrl.replace(/\/$/, '') + pathClean;
    }
    return window.location.origin + pathClean;
  }

  function updateQrNetworkBadges(url) {
    if (typeof document === 'undefined') return;
    const inlineBadge = document.getElementById('inline-qr-url-badge');
    if (inlineBadge) {
      inlineBadge.textContent = url;
      inlineBadge.title = `Đường dẫn QR: ${url}`;
    }

    const modalBadge = document.getElementById('referral-qr-network-badge');
    if (!modalBadge) return;

    const escape = (str) => String(str).replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
    const isFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
    const hasLan = cachedNetworkInfo && cachedNetworkInfo.primaryLanUrl && url.startsWith(cachedNetworkInfo.primaryLanUrl.replace(/\/$/, ''));
    const isLocalhostOnly = typeof window !== 'undefined' && window.location && isLocalOrVirtualHost(window.location.hostname) && !hasLan;

    if (isFile) {
      modalBadge.className = 'p-2.5 rounded-xl bg-error-container/40 border border-error/30 text-left text-[11px] text-on-error-container leading-relaxed';
      modalBadge.innerHTML = '<strong>Chế độ file://</strong> — Điện thoại sẽ không mở được file cục bộ. Hãy khởi động máy chủ <code>npm start</code> để QR tự động dùng IP Wi-Fi LAN.';
    } else if (hasLan) {
      modalBadge.className = 'p-2.5 rounded-xl bg-tertiary-fixed/50 border border-tertiary/30 text-left text-[11px] text-on-tertiary-fixed-variant leading-relaxed';
      modalBadge.innerHTML = `<strong>Sẵn sàng quét trên điện thoại (Wi-Fi LAN):</strong> <span class="font-mono break-all">${escape(url)}</span><br/><span class="opacity-85">Điện thoại cần dùng chung mạng Wi-Fi với máy tính này.</span>`;
    } else if (isLocalhostOnly && (networkInfoState === 'idle' || networkInfoState === 'loading')) {
      modalBadge.className = 'p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-left text-[11px] text-on-surface-variant leading-relaxed';
      modalBadge.innerHTML = '<strong>Đang dò địa chỉ Wi-Fi LAN từ máy chủ...</strong> Mã QR sẽ tự cập nhật sang IP mạng nội bộ trong giây lát.';
    } else if (isLocalhostOnly) {
      modalBadge.className = 'p-2.5 rounded-xl bg-primary-container/50 border border-primary/30 text-left text-[11px] text-on-primary-container leading-relaxed';
      modalBadge.innerHTML = `<strong>Cảnh báo địa chỉ cục bộ:</strong> Đang mã hóa <span class="font-mono">${escape(url)}</span> (chỉ mở được trên máy tính này). Hãy chạy <code>npm start</code> thay vì máy chủ tĩnh để QR tự lấy IP Wi-Fi.`;
    } else {
      modalBadge.className = 'p-2.5 rounded-xl bg-tertiary-fixed/40 border border-tertiary/30 text-left text-[11px] text-on-tertiary-fixed-variant leading-relaxed';
      modalBadge.innerHTML = `<strong>Đang mã hóa liên kết mạng:</strong> <span class="font-mono break-all">${escape(url)}</span>`;
    }
  }

  function renderReferralQR(customUrl) {
    const canvas = document.getElementById('referral-qr-canvas');
    const inlineCanvas = document.getElementById('inline-referral-qr-canvas');
    const input = document.getElementById('referral-link-input');
    const url = customUrl || getReferralUrl();
    if (input) input.value = url;
    updateQrNetworkBadges(url);

    if (window.QRCodeGenerator && window.QRCodeGenerator.renderToCanvas) {
      if (canvas) {
        window.QRCodeGenerator.renderToCanvas(canvas, url, {
          size: 280,
          darkColor: '#1b1c1a',
          bgColor: '#ffffff',
          logoBgColor: '#835500',
          logoBorderColor: '#f5a623',
          logoText: 'CÔ TƯ'
        });
      }
      if (inlineCanvas) {
        window.QRCodeGenerator.renderToCanvas(inlineCanvas, url, {
          size: 240,
          darkColor: '#1b1c1a',
          bgColor: '#ffffff',
          logoBgColor: '#835500',
          logoBorderColor: '#f5a623',
          logoText: 'CÔ TƯ'
        });
      }
    }
  }

  function openReferralQRModal() {
    const modal = document.getElementById('referral-qr-modal');
    if (!modal) return;
    if (networkInfoState !== 'ready' && typeof window !== 'undefined' && window.location && isLocalOrVirtualHost(window.location.hostname)) {
      fetchNetworkInfo(networkInfoState === 'unavailable');
    }
    const url = getReferralUrl();
    renderReferralQR(url);
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);

    // Close mobile nav drawer if open
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    if (mobileDrawer && !mobileDrawer.classList.contains('hidden')) {
      mobileDrawer.classList.remove('active');
      setTimeout(() => mobileDrawer.classList.add('hidden'), 250);
    }
  }

  function closeReferralQRModal() {
    const modal = document.getElementById('referral-qr-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function setupReferralQRModal() {
    renderReferralQR(getReferralUrl());

    document.querySelectorAll('[data-action="open-referral-qr"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openReferralQRModal();
      });
    });

    const closeBtn = document.getElementById('btn-close-referral-qr');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeReferralQRModal);
    }

    const downloadReferralQRPNG = () => {
      renderReferralQR(getReferralUrl());
      const canvas = document.getElementById('referral-qr-canvas');
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'Ma-QR-Gioi-Thieu-Tour-Co-Tu.png';
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Đã tải hình ảnh mã QR giới thiệu về máy!', 'success');
    };

    const downloadBtn = document.getElementById('btn-download-referral-qr');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadReferralQRPNG);
    }

    document.querySelectorAll('[data-action="download-referral-qr"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadReferralQRPNG();
      });
    });

    const copyBtn = document.getElementById('btn-copy-referral-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const input = document.getElementById('referral-link-input');
        const url = input ? input.value : getReferralUrl();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            showToast('Đã sao chép liên kết trang web Cô Tư vào bộ nhớ tạm!', 'success');
          }).catch(() => {
            fallbackCopyText(url);
          });
        } else {
          fallbackCopyText(url);
        }
      });
    }

    const nativeShareBtn = document.getElementById('btn-share-referral-native');
    if (nativeShareBtn) {
      nativeShareBtn.addEventListener('click', () => {
        const input = document.getElementById('referral-link-input');
        const url = input ? input.value : getReferralUrl();
        if (navigator.share) {
          navigator.share({
            title: 'Tour Hẻm Ẩm Thực Cô Tư Sài Gòn',
            text: 'Khám phá 5 trạm ẩm thực hẻm sâu Sài Gòn cùng Cô Tư! Nhận ngay ưu đãi 10% với mã HEMSAIGON.',
            url: url
          }).catch(() => {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            showToast('Đã sao chép liên kết giới thiệu! Hãy dán và gửi cho bạn bè ngay nhé!', 'success');
          }).catch(() => {
            fallbackCopyText(url);
          });
        } else {
          fallbackCopyText(url);
        }
      });
    }

    function fallbackCopyText(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        const ok = document.execCommand('copy');
        if (ok) {
          showToast('Đã sao chép liên kết trang web Cô Tư vào bộ nhớ tạm!', 'success');
        } else {
          showToast('Không thể tự động sao chép, vui lòng copy liên kết trong ô!', 'info');
        }
      } catch (err) {
        showToast('Không thể tự động sao chép, vui lòng copy liên kết trong ô!', 'info');
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  // Backdrop dismissals for all dialog modals
  function setupBackdropDismissals() {
    ['secret-tip-modal', 'certificate-modal', 'auth-modal', 'customer-portal-modal', 'referral-qr-modal'].forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 250);
          }
        });
      }
    });
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  return {
    init,
    showToast,
    openReferralQRModal,
    closeReferralQRModal,
    renderReferralQR
  };
})();
