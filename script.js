// Theme Management
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem("theme") || "light";
        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
    }

    applyTheme() {
        document.documentElement.setAttribute("data-theme", this.theme);
        this.updateToggleButton();
    }

    updateToggleButton() {
        const toggleBtn = document.getElementById("themeToggle");
        if (toggleBtn) {
            toggleBtn.setAttribute("aria-label", 
                this.theme === "light" ? "تبديل إلى الوضع الليلي" : "تبديل إلى الوضع النهاري"
            );
        }
    }

    toggle() {
        this.theme = this.theme === "light" ? "dark" : "light";
        localStorage.setItem("theme", this.theme);
        this.applyTheme();
        
        // Add smooth transition effect
        document.body.style.transition = "all 0.3s ease";
        setTimeout(() => {
            document.body.style.transition = "";
        }, 300);
    }

    bindEvents() {
        const toggleBtn = document.getElementById("themeToggle");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => this.toggle());
        }
    }
}

// Form Management
class FormManager {
    constructor() {
        this.form = document.getElementById("surveyForm");
        this.submitBtn = document.getElementById("submitBtn");
        this.googleAppsScriptUrl = "https://script.google.com/macros/s/AKfycbyq9d-hstJz_rJjs-ujTmX2_o09HdjFGBv8YXjzLAlWZJDp80Hlwrdwm2DAPYQ8jr8sQA/exec"; // سيتم استبداله بالرابط الفعلي
        this.wordpressApiUrl = "https://elsoot.com/wp-json/alsawt-survey/v1/submit"; // نقطة نهاية الإضافة المخصصة
        this.wordpressAuth = "QWRtaW46a2tLUSByMWd2IG5md00galZFQyBQZ1drIHl5eXU="; // استبدل بـ Base64(username:password) لمستخدم لديه صلاحية إنشاء مستخدمين
        this.init();
    }

    init() {
        if (this.form) {
            this.bindEvents();
            this.loadDraft();
        }
    }

    bindEvents() {
        // Form submission
        this.form.addEventListener("submit", (e) => this.handleSubmit(e));
        
        // Auto-save draft
        this.form.addEventListener("input", () => this.saveDraft());
        
        // Real-time validation
        const inputs = this.form.querySelectorAll("input, select, textarea");
        inputs.forEach(input => {
            input.addEventListener("blur", () => this.validateField(input));
            input.addEventListener("input", () => this.clearFieldError(input));
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.showMessage("error", "خطأ في البيانات", "يرجى التأكد من ملء جميع الحقول المطلوبة بشكل صحيح");
            return;
        }

        this.setLoading(true);
        this.showLoadingOverlay();

        try {
            // جمع بيانات النموذج
            const formData = new FormData(this.form);
            
            // تحويل FormData إلى URLSearchParams للإرسال إلى Google Apps Script
            const params = new URLSearchParams();
            for (let [key, value] of formData.entries()) {
                params.append(key, value);
            }

            // إرسال البيانات إلى Google Apps Script
            const googleSheetResponse = await fetch(this.googleAppsScriptUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString()
            });

            const googleSheetResult = await googleSheetResponse.json();

            if (googleSheetResult.status === "success") {
                console.log("Data sent to Google Sheet successfully.");

                // إرسال البيانات إلى ووردبريس
                const wordpressData = {
                    fullName: formData.get("fullName"),
                    birthDate: formData.get("birthDate"),
                    job: formData.get("job"),
                    maritalStatus: formData.get("maritalStatus"),
                    phone: formData.get("phone"),
                    address: formData.get("address"),
                    district: formData.get("district"),
                    candidate: formData.get("candidate"),
                    requests: formData.get("requests")
                };

                const wordpressResponse = await fetch(this.wordpressApiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(wordpressData)
                });

                const wordpressResult = await wordpressResponse.json();

                if (wordpressResponse.ok && wordpressResult.status === "success") {
                    console.log("Data sent to WordPress successfully.", wordpressResult);
                    this.showMessage("success", "تم الإرسال بنجاح!", "شكراً لك على مشاركتك في الاستطلاع. تم حفظ إجاباتك بنجاح في Google Sheet وووردبريس.");
                    this.form.reset();
                    this.clearDraft();
                    this.addSuccessAnimation();
                } else {
                    console.warn("WordPress submission failed, but Google Sheet succeeded:", wordpressResult);
                    this.showMessage("success", "تم الإرسال بنجاح!", "شكراً لك على مشاركتك في الاستطلاع. تم حفظ إجاباتك في Google Sheet بنجاح.");
                    this.form.reset();
                    this.clearDraft();
                    this.addSuccessAnimation();
                }

            } else {
                throw new Error(googleSheetResult.message || "حدث خطأ غير متوقع أثناء الإرسال إلى Google Sheet.");
            }

        } catch (error) {
            console.error("Error submitting form:", error);
            this.showMessage("error", "خطأ في الإرسال", `حدث خطأ أثناء إرسال البيانات: ${error.message}. يرجى المحاولة مرة أخرى.`);
        } finally {
            this.setLoading(false);
            this.hideLoadingOverlay();
        }
    }

    validateForm() {
        const inputs = this.form.querySelectorAll("input[required], select[required], textarea[required]");
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = "";

        // Required field validation
        if (field.hasAttribute("required") && !value) {
            isValid = false;
            errorMessage = "هذا الحقل مطلوب";
        }

        // Phone number validation
        if (field.type === "tel" && value) {
            const phoneRegex = /^01[0-9]{9}$/;
            if (!phoneRegex.test(value)) {
                isValid = false;
                errorMessage = "يرجى إدخال رقم هاتف صحيح (01xxxxxxxxx)";
            }
        }

        // Name validation
        if (field.name === "fullName" && value) {
            if (value.length < 3) {
                isValid = false;
                errorMessage = "يجب أن يكون الاسم 3 أحرف على الأقل";
            }
        }

        this.showFieldError(field, isValid ? "" : errorMessage);
        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        if (message) {
            field.style.borderColor = "#e53e3e";
            const errorDiv = document.createElement("div");
            errorDiv.className = "field-error";
            errorDiv.style.cssText = "color: #e53e3e; font-size: 0.875rem; margin-top: 5px;";
            errorDiv.textContent = message;
            field.parentNode.appendChild(errorDiv);
        }
    }

    clearFieldError(field) {
        field.style.borderColor = "";
        const errorDiv = field.parentNode.querySelector(".field-error");
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    setLoading(loading) {
        if (loading) {
            this.submitBtn.classList.add("loading");
            this.submitBtn.disabled = true;
        } else {
            this.submitBtn.classList.remove("loading");
            this.submitBtn.disabled = false;
        }
    }

    showLoadingOverlay() {
        const overlay = document.getElementById("loadingOverlay");
        if (overlay) {
            overlay.style.display = "flex";
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById("loadingOverlay");
        if (overlay) {
            overlay.style.display = "none";
        }
    }

    showMessage(type, title, message) {
        const overlay = document.getElementById("messageOverlay");
        const icon = document.getElementById("messageIcon");
        const titleEl = document.getElementById("messageTitle");
        const textEl = document.getElementById("messageText");
        const btn = document.getElementById("messageBtn");

        if (overlay && icon && titleEl && textEl && btn) {
            icon.className = `message-icon ${type}-icon`;
            icon.textContent = type === "success" ? "✅" : "❌";
            titleEl.textContent = title;
            textEl.textContent = message;
            
            overlay.style.display = "flex";
            
            btn.onclick = () => {
                overlay.style.display = "none";
            };
        }
    }

    addSuccessAnimation() {
        this.form.classList.add("fade-in");
        setTimeout(() => {
            this.form.classList.remove("fade-in");
        }, 600);
    }

    saveDraft() {
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());
        localStorage.setItem("surveyDraft", JSON.stringify(data));
    }

    loadDraft() {
        const draft = localStorage.getItem("surveyDraft");
        if (draft) {
            try {
                const data = JSON.parse(draft);
                Object.keys(data).forEach(key => {
                    const field = this.form.querySelector(`[name="${key}"]`);
                    if (field && data[key]) {
                        field.value = data[key];
                    }
                });
            } catch (error) {
                console.error("Error loading draft:", error);
            }
        }
    }

    clearDraft() {
        localStorage.removeItem("surveyDraft");
    }

    // دالة لتحديث رابط Google Apps Script
    setGoogleAppsScriptUrl(url) {
        this.googleAppsScriptUrl = url;
    }
}

// Link Management
class LinkManager {
    constructor() {
        this.init();
    }

    init() {
        this.bindWhatsAppLinks();
        this.bindSponsorLinks();
        this.bindGroupLink();
    }

    bindWhatsAppLinks() {
        // WhatsApp link in footer
        const whatsappLink = document.querySelector(".whatsapp-link");
        if (whatsappLink) {
            whatsappLink.addEventListener("click", (e) => {
                e.preventDefault();
                const phoneNumber = "201287296630";
                const message = encodeURIComponent("مرحباً، أريد التواصل معكم بخصوص موقع الصوت يجمعنا");
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                window.open(whatsappUrl, "_blank");
            });
        }
    }

    bindSponsorLinks() {
        // Newspaper link
        const newspaperLink = document.getElementById("newspaperLink");
        if (newspaperLink) {
            newspaperLink.addEventListener("click", (e) => {
                e.preventDefault();
                window.open("https://www.facebook.com/share/1C7Pbbs3Mq/?mibextid=wwXIfr", "_blank");
            });
        }

        // Academy link
        const academyLink = document.getElementById("academyLink");
        if (academyLink) {
            academyLink.addEventListener("click", (e) => {
                e.preventDefault();
                window.open("https://www.facebook.com/share/1BH661fktk/?mibextid=wwXIfr", "_blank");
            });
        }
    }

    bindGroupLink() {
        const groupLink = document.getElementById("groupLink");
        if (groupLink) {
            groupLink.addEventListener("click", (e) => {
                e.preventDefault();
                const phoneNumber = "201287296630";
                const message = encodeURIComponent("أريد الانضمام إلى مجموعة الصوت يجمعنا");
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                window.open(whatsappUrl, "_blank");
            });
        }
    }
}

// Scroll Effects
class ScrollEffects {
    constructor() {
        this.init();
    }

    init() {
        this.addScrollAnimations();
        this.addParallaxEffect();
    }

    addScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px"
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("slide-up");
                }
            });
        }, observerOptions);

        // Observe elements for animation
        const animatedElements = document.querySelectorAll(
            ".form-container, .group-card, .sponsor-card, .section-title"
        );
        
        animatedElements.forEach(el => {
            observer.observe(el);
        });
    }

    addParallaxEffect() {
        let ticking = false;

        function updateParallax() {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll(".parliament-image, .logo");
            
            parallaxElements.forEach(element => {
                const speed = 0.5;
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
            
            ticking = false;
        }

        function requestTick() {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }

        window.addEventListener("scroll", requestTick);
    }
}

// Accessibility Enhancements
class AccessibilityManager {
    constructor() {
        this.init();
    }

    init() {
        this.addKeyboardNavigation();
        this.addFocusManagement();
        this.addAriaLabels();
    }

    addKeyboardNavigation() {
        // Allow Enter key to submit form
        document.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.ctrlKey) {
                const form = document.getElementById("surveyForm");
                if (form) {
                    form.dispatchEvent(new Event("submit"));
                }
            }
        });
    }

    addFocusManagement() {
        // Improve focus visibility
        const focusableElements = document.querySelectorAll(
            "button, input, select, textarea, a[href]"
        );

        focusableElements.forEach(element => {
            element.addEventListener("focus", () => {
                element.style.outline = "3px solid var(--primary-color)";
                element.style.outlineOffset = "2px";
            });

            element.addEventListener("blur", () => {
                element.style.outline = "";
                element.style.outlineOffset = "";
            });
        });
    }

    addAriaLabels() {
        // Add missing aria labels
        const submitBtn = document.getElementById("submitBtn");
        if (submitBtn && !submitBtn.getAttribute("aria-label")) {
            submitBtn.setAttribute("aria-label", "إرسال نموذج الاستطلاع");
        }

        // Add role attributes
        const form = document.getElementById("surveyForm");
        if (form) {
            form.setAttribute("role", "form");
            form.setAttribute("aria-label", "نموذج استطلاع رأي المواطنين");
        }
    }
}

// Performance Optimizations
class PerformanceManager {
    constructor() {
        this.init();
    }

    init() {
        this.lazyLoadImages();
        this.optimizeAnimations();
    }

    lazyLoadImages() {
        const images = document.querySelectorAll("img[src]");
        
        if ("IntersectionObserver" in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.classList.add("fade-in");
                        imageObserver.unobserve(img);
                    }
                });
            });

            images.forEach(img => imageObserver.observe(img));
        }
    }

    optimizeAnimations() {
        // Reduce animations on low-end devices
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        
        if (prefersReducedMotion.matches) {
            document.documentElement.style.setProperty("--animation-duration", "0.1s");
        }
    }
}

// متغير عام لإدارة النموذج
let formManager;

// Initialize all managers when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Initialize all components
    new ThemeManager();
    formManager = new FormManager();
    new LinkManager();
    new ScrollEffects();
    new AccessibilityManager();
    new PerformanceManager();

    // Add smooth loading animation
    document.body.classList.add("fade-in");
    
    // Console welcome message
    console.log("🎉 موقع الصوت يجمعنا - دائرة قويسنا وبركة السبع");
    console.log("📱 للتواصل: 01287296630");
    console.log("🏢 شركة الصوت الدولية للخدمات الإعلامية");
    console.log("🔗 تم تكوين النموذج للعمل مع Google Apps Script");
});

// دالة عامة لتحديث رابط Google Apps Script
function setGoogleAppsScriptUrl(url) {
    if (formManager) {
        formManager.setGoogleAppsScriptUrl(url);
        console.log("✅ تم تحديث رابط Google Apps Script:", url);
    } else {
        console.error("❌ لم يتم تهيئة FormManager بعد");
    }
}

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Save draft when page becomes hidden
        if (formManager) {
            formManager.saveDraft();
        }
    }
});

// Handle online/offline status
window.addEventListener("online", () => {
    console.log("✅ الاتصال بالإنترنت متاح");
});

window.addEventListener("offline", () => {
    console.log("❌ لا يوجد اتصال بالإنترنت");
    alert("تم فقدان الاتصال بالإنترنت. سيتم حفظ بياناتك محلياً.");
});

// Export for potential external use
window.AlsawtWebsite = {
    ThemeManager,
    FormManager,
    LinkManager,
    ScrollEffects,
    AccessibilityManager,
    PerformanceManager,
    setGoogleAppsScriptUrl
};



