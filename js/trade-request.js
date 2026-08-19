/**
 * Maa Enterprises — Cyber Cafe & Online Service Center
 * PART 4 — Trade & Bulk Service Request Controller
 * Author: Senior Full-Stack Frontend Architect
 */
'use strict';
/**
 * Generate Unique Cryptographically Strong Trade Request ID (TRADE-XXXXXX)
 * @returns {string}
 */
function generateTradeRequestId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const existingApps = window.StorageService ? window.StorageService.getApplications() : [];
  const existingIds = new Set(existingApps.map(a => a.requestId));
  let candidateId = '';
  let attempts = 0;
  do {
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      randomPart += chars[randomIndex];
    }
    candidateId = `TRADE-${randomPart}`;
    attempts++;
  } while (existingIds.has(candidateId) && attempts < 100);
  return candidateId;
}
/**
 * Trade Request Form Controller
 */
class TradeRequestController {
  constructor() {
    this.isSubmitting = false;
    // Form & Input Elements
    this.form = document.getElementById('tradeForm');
    this.serviceSelect = document.getElementById('tradeServiceSelect');
    this.submitBtn = document.getElementById('tradeSubmitBtn');
    this.successModal = document.getElementById('tradeSuccessModal');
    this.copyBtn = document.getElementById('copyTradeIdBtn');
    this.modalCloseBtn = document.getElementById('tradeModalCloseBtn');
    this.trackBtn = document.getElementById('tradeTrackBtn');
    // Field Inputs
    this.orgNameInput = document.getElementById('orgName');
    this.orgTypeSelect = document.getElementById('orgType');
    this.contactPersonInput = document.getElementById('contactPerson');
    this.mobileInput = document.getElementById('tradeMobile');
    this.whatsappInput = document.getElementById('tradeWhatsapp');
    this.sameAsMobileCheck = document.getElementById('sameAsMobileCheck');
    this.emailInput = document.getElementById('tradeEmail');
    this.addressInput = document.getElementById('tradeAddress');
    this.quantityInput = document.getElementById('tradeQuantity');
    this.preferredDateInput = document.getElementById('tradeDate');
    this.notesInput = document.getElementById('tradeNotes');
    this.whatsappPrefCheck = document.getElementById('whatsappPrefCheck');
    this.consentCheck = document.getElementById('tradeConsentCheck');
  }
  init() {
    if (!this.form) return;
    this.populateServiceDropdown();
    this.bindEvents();
  }
  populateServiceDropdown() {
    if (!this.serviceSelect) return;
    const allServices = typeof getAllServices === 'function' ? getAllServices(false) : [];
    // Group services by category for clean UX
    const grouped = {};
    allServices.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    let optionsHtml = '<option value="">-- Select Required Service / Category --</option>';
    // Add custom / generic bulk options first
    optionsHtml += `
      <optgroup label="Common Bulk Requirements">
        <option value="bulk-form-filling">Bulk Online Form Filling (Admissions / Recruitments)</option>
        <option value="bulk-typing-documentation">Bulk Document Typing & Data Entry (Hindi / English)</option>
        <option value="bulk-scanning-digitization">Bulk Document Scanning & Digitization</option>
        <option value="bulk-printing-lamination">Bulk Printing & Identity Lamination</option>
        <option value="bulk-pancard-drives">Institutional PAN Card Drive</option>
      </optgroup>
    `;
    Object.keys(grouped).forEach(cat => {
      optionsHtml += `<optgroup label="${escapeHtml(cat)}">`;
      grouped[cat].forEach(s => {
        optionsHtml += `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`;
      });
      optionsHtml += '</optgroup>';
    });
    optionsHtml += `
      <optgroup label="Custom / Other">
        <option value="other-custom-trade">Other Custom Commercial / Institutional Requirement</option>
      </optgroup>
    `;
    this.serviceSelect.innerHTML = optionsHtml;
  }
  bindEvents() {
    // Form Submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    // Auto-fill WhatsApp if checkbox toggled
    if (this.sameAsMobileCheck && this.whatsappInput) {
      this.sameAsMobileCheck.addEventListener('change', () => {
        if (this.sameAsMobileCheck.checked && this.mobileInput) {
          this.whatsappInput.value = this.mobileInput.value;
          this.whatsappInput.disabled = true;
        } else {
          this.whatsappInput.disabled = false;
        }
      });
      if (this.mobileInput) {
        this.mobileInput.addEventListener('input', () => {
          if (this.sameAsMobileCheck.checked) {
            this.whatsappInput.value = this.mobileInput.value;
          }
        });
      }
    }
    // Clear error states on input
    const inputs = [
      this.orgNameInput, this.orgTypeSelect, this.contactPersonInput,
      this.mobileInput, this.whatsappInput, this.emailInput,
      this.addressInput, this.serviceSelect, this.quantityInput, this.consentCheck
    ];
    inputs.forEach(input => {
      if (!input) return;
      input.addEventListener('input', () => this.clearFieldError(input));
      input.addEventListener('change', () => this.clearFieldError(input));
    });
    // Copy Trade Request ID
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => {
        const idText = document.getElementById('tradeModalIdText')?.textContent;
        if (idText) {
          this.copyToClipboard(idText);
        }
      });
    }
    // Modal Close
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => {
        this.closeSuccessModal();
      });
    }
    // Track Button from Modal
    if (this.trackBtn) {
      this.trackBtn.addEventListener('click', () => {
        const idText = document.getElementById('tradeModalIdText')?.textContent;
        if (idText) {
          window.location.href = `track-request.html?id=${encodeURIComponent(idText)}`;
        }
      });
    }
    // Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.successModal?.classList.contains('modal-active')) {
        this.closeSuccessModal();
      }
    });
  }
  setFieldError(inputEl, message) {
    if (!inputEl) return;
    const group = inputEl.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      const errEl = group.querySelector('.error-message');
      if (errEl) errEl.textContent = message;
    }
    inputEl.setAttribute('aria-invalid', 'true');
  }
  clearFieldError(inputEl) {
    if (!inputEl) return;
    const group = inputEl.closest('.form-group');
    if (group) {
      group.classList.remove('has-error');
      const errEl = group.querySelector('.error-message');
      if (errEl) errEl.textContent = '';
    }
    inputEl.removeAttribute('aria-invalid');
  }
  validateForm() {
    let isValid = true;
    let firstError = null;
    // Org Name
    const orgName = this.orgNameInput?.value?.trim();
    if (!orgName || orgName.length < 3) {
      this.setFieldError(this.orgNameInput, 'Please enter organization/business name (min 3 characters).');
      isValid = false;
      if (!firstError) firstError = this.orgNameInput;
    }
    // Org Type
    if (!this.orgTypeSelect?.value) {
      this.setFieldError(this.orgTypeSelect, 'Please select organization type.');
      isValid = false;
      if (!firstError) firstError = this.orgTypeSelect;
    }
    // Contact Person
    const contact = this.contactPersonInput?.value?.trim();
    if (!contact || contact.length < 2) {
      this.setFieldError(this.contactPersonInput, 'Please enter contact person name.');
      isValid = false;
      if (!firstError) firstError = this.contactPersonInput;
    }
    // Mobile
    const mobileClean = (this.mobileInput?.value || '').replace(/[^0-9]/g, '');
    const normalizedMobile = mobileClean.length === 12 && mobileClean.startsWith('91') 
      ? mobileClean.substring(2) 
      : mobileClean;
    if (normalizedMobile.length !== 10 || !/^[6-9]\d{9}$/.test(normalizedMobile)) {
      this.setFieldError(this.mobileInput, 'Please enter a valid 10-digit mobile number.');
      isValid = false;
      if (!firstError) firstError = this.mobileInput;
    }
    // Email (optional)
    if (this.emailInput?.value) {
      const email = this.emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.setFieldError(this.emailInput, 'Please enter a valid email address.');
        isValid = false;
        if (!firstError) firstError = this.emailInput;
      }
    }
    // Full Address
    const address = this.addressInput?.value?.trim();
    if (!address || address.length < 6) {
      this.setFieldError(this.addressInput, 'Please enter complete organization address (min 6 characters).');
      isValid = false;
      if (!firstError) firstError = this.addressInput;
    }
    // Service Select
    if (!this.serviceSelect?.value) {
      this.setFieldError(this.serviceSelect, 'Please select the required service or bulk category.');
      isValid = false;
      if (!firstError) firstError = this.serviceSelect;
    }
    // Estimated Quantity
    const qty = this.quantityInput?.value?.trim();
    if (!qty) {
      this.setFieldError(this.quantityInput, 'Please specify approximate number of applications/documents.');
      isValid = false;
      if (!firstError) firstError = this.quantityInput;
    }
    // Consent
    if (!this.consentCheck?.checked) {
      this.setFieldError(this.consentCheck, 'You must confirm that the provided details are correct.');
      isValid = false;
      if (!firstError) firstError = this.consentCheck;
    }
    if (!isValid && firstError) {
      firstError.focus();
    }
    return isValid;
  }
  handleSubmit() {
    if (this.isSubmitting) return;
    if (!this.validateForm()) return;
    this.isSubmitting = true;
    this.setLoadingState(true);
    // Normalize Data
    const orgName = this.orgNameInput.value.trim();
    const orgType = this.orgTypeSelect.value;
    const contactPerson = this.contactPersonInput.value.trim();
    const mobileClean = this.mobileInput.value.replace(/[^0-9]/g, '');
    const normalizedMobile = mobileClean.length === 12 && mobileClean.startsWith('91') ? mobileClean.substring(2) : mobileClean;
    const whatsappVal = this.sameAsMobileCheck?.checked 
      ? normalizedMobile 
      : (this.whatsappInput?.value || '').replace(/[^0-9]/g, '') || normalizedMobile;
    const email = this.emailInput?.value ? this.emailInput.value.trim().toLowerCase() : '';
    const address = this.addressInput.value.trim();
    // Resolve Service Title
    const selectedOption = this.serviceSelect.options[this.serviceSelect.selectedIndex];
    const serviceTitle = selectedOption ? selectedOption.text : 'Bulk Service';
    const serviceId = this.serviceSelect.value;
    const quantity = this.quantityInput.value.trim();
    const preferredDate = this.preferredDateInput?.value || '';
    const notes = this.notesInput?.value ? this.notesInput.value.trim() : '';
    const whatsappPref = this.whatsappPrefCheck?.checked ?? true;
    // Generate Trade Request ID (TRADE-XXXXXX)
    const requestId = generateTradeRequestId();
    const tradeRecord = {
      requestId: requestId,
      type: 'trade',
      organizationName: orgName,
      organizationType: orgType,
      contactPerson: contactPerson,
      customer: {
        name: contactPerson,
        orgName: orgName,
        mobile: normalizedMobile,
        whatsapp: whatsappVal,
        email: email,
        address: address
      },
      serviceId: serviceId,
      serviceName: serviceTitle,
      quantity: quantity,
      preferredDate: preferredDate,
      notes: notes,
      whatsappAvailable: whatsappPref,
      status: 'pending',
      paymentStatus: 'pending',
      staffNote: '',
      createdAt: new Date().toISOString()
    };
    // Save to Firestore if available
    try {
      if (window.FirebaseApp && window.FirebaseApp.db) {
        const { db, doc, setDoc, serverTimestamp } = window.FirebaseApp;
        setDoc(doc(db, 'tradeRequests', requestId), {
          ...tradeRecord,
          serverTimestamp: serverTimestamp()
        }).catch(e => console.warn('[Trade] Firestore async save notice:', e.message));
      }
    } catch (err) {}

    // Save to LocalStorage
    try {
      const existingTrade = JSON.parse(localStorage.getItem('maa_trade_requests') || '[]');
      existingTrade.unshift(tradeRecord);
      localStorage.setItem('maa_trade_requests', JSON.stringify(existingTrade.slice(0, 50)));
    } catch (e) {}

    setTimeout(() => {
      const saved = window.StorageService ? window.StorageService.saveApplication(tradeRecord) : true;
      this.setLoadingState(false);
      this.isSubmitting = false;
      if (saved) {
        this.showSuccessModal(tradeRecord);
      } else {
        if (window.showToast) window.showToast('Failed to save trade request. Please try again.', 'error');
      }
    }, 450);
  }
  setLoadingState(isLoading) {
    if (!this.submitBtn) return;
    if (isLoading) {
      this.submitBtn.disabled = true;
      this.submitBtn.innerHTML = '<span class="btn-spinner" style="display:inline-block; margin-right:0.5rem;"></span> Submitting Inquiry...';
    } else {
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = '<span>Submit Trade Request</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    }
  }
  showSuccessModal(record) {
    if (!this.successModal) return;
    // Populate Data
    const idEl = document.getElementById('tradeModalIdText');
    if (idEl) idEl.textContent = record.requestId;
    const orgEl = document.getElementById('tradeModalOrgVal');
    if (orgEl) orgEl.textContent = record.organizationName;
    const contactEl = document.getElementById('tradeModalContactVal');
    if (contactEl) contactEl.textContent = record.contactPerson;
    const serviceEl = document.getElementById('tradeModalServiceVal');
    if (serviceEl) serviceEl.textContent = record.serviceName;
    const qtyEl = document.getElementById('tradeModalQtyVal');
    if (qtyEl) qtyEl.textContent = record.quantity;
    // Pre-filled WhatsApp message
    const waMsg = `Hello Maa Enterprises,\nI have submitted a Trade / Bulk Service inquiry for *${record.organizationName}*.\n*Trade Request ID:* ${record.requestId}\n*Contact Person:* ${record.contactPerson}\n*Requirement:* ${record.serviceName}\n*Volume:* ${record.quantity}\nPlease share the commercial quotation and next steps.`;
    const waUrl = `https://wa.me/919693125648?text=${encodeURIComponent(waMsg)}`;
    const waBtn = document.getElementById('tradeModalWhatsappBtn');
    if (waBtn) waBtn.href = waUrl;
    // Open Modal
    this.successModal.classList.add('modal-active');
    this.successModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-scroll-lock');
    if (this.copyBtn) this.copyBtn.focus();
  }
  closeSuccessModal() {
    if (!this.successModal) return;
    this.successModal.classList.remove('modal-active');
    this.successModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-scroll-lock');
    this.form.reset();
  }
  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast('Trade Request ID copied to clipboard!', 'success');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }
  fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      if (window.showToast) window.showToast('Trade Request ID copied to clipboard!', 'success');
    } catch (err) {
      if (window.showToast) window.showToast('Please copy ID manually: ' + text, 'info');
    }
    document.body.removeChild(textArea);
  }
}
/**
 * Safe HTML Escaping
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
/**
 * Bootstrap on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  const tradeController = new TradeRequestController();
  tradeController.init();
  window.MaaTradeController = tradeController;
});
window.generateTradeRequestId = generateTradeRequestId;
