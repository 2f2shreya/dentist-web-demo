document.addEventListener('DOMContentLoaded', () => {
    const scrollProgress = document.getElementById('scrollProgress');
    
    function updateScrollProgress() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        scrollProgress.style.width = progress + '%';
    }
    const navbar = document.getElementById('navbar');
    let lastScrollY = 0;

    function handleNavScroll() {
        const scrollY = window.scrollY;
        
        if (scrollY > 80) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScrollY = scrollY;
    }
    window.addEventListener('scroll', () => {
        requestAnimationFrame(() => {
            updateScrollProgress();
            handleNavScroll();
            handleBackToTop();
        });
    }, { passive: true });
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    function updateActiveNav() {
        const scrollY = window.scrollY + 200;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    const navToggle = document.getElementById('navToggle');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const bottomMenuToggle = document.getElementById('bottomMenuToggle');

    function toggleMobileNav() {
        navToggle.classList.toggle('active');
        mobileNavOverlay.classList.toggle('active');
        document.body.style.overflow = mobileNavOverlay.classList.contains('active') ? 'hidden' : '';
    }

    function closeMobileNav() {
        navToggle.classList.remove('active');
        mobileNavOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', toggleMobileNav);
    
    if (bottomMenuToggle) {
        bottomMenuToggle.addEventListener('click', toggleMobileNav);
    }

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', closeMobileNav);
    });
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 80;
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                closeMobileNav();
            }
        });
    });
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    let countersAnimated = false;

    function animateCounters() {
        if (countersAnimated) return;
        
        statNumbers.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            const duration = 2000;
            const start = performance.now();
            
            function easeOutExpo(t) {
                return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            }
            
            function updateCounter(currentTime) {
                const elapsed = currentTime - start;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutExpo(progress);
                const currentValue = Math.floor(easedProgress * target);
                
                counter.textContent = currentValue.toLocaleString();
                
                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target.toLocaleString();
                }
            }
            
            requestAnimationFrame(updateCounter);
        });
        
        countersAnimated = true;
    }

    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        
        statsObserver.observe(statsSection);
    }
    const testimonialTrack = document.getElementById('testimonialTrack');
    const testimonialPrev = document.getElementById('testimonialPrev');
    const testimonialNext = document.getElementById('testimonialNext');
    const testimonialDots = document.getElementById('testimonialDots');
    let currentSlide = 0;
    const totalSlides = document.querySelectorAll('.testimonial-slide').length;
    let autoplayInterval;

    function goToSlide(index) {
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;
        currentSlide = index;
        
        testimonialTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
        const dots = testimonialDots.querySelectorAll('.dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    if (testimonialNext) testimonialNext.addEventListener('click', () => {
        nextSlide();
        resetAutoplay();
    });

    if (testimonialPrev) testimonialPrev.addEventListener('click', () => {
        prevSlide();
        resetAutoplay();
    });

    if (testimonialDots) {
        testimonialDots.querySelectorAll('.dot').forEach((dot, index) => {
            dot.addEventListener('click', () => {
                goToSlide(index);
                resetAutoplay();
            });
        });
    }
    function startAutoplay() {
        autoplayInterval = setInterval(nextSlide, 5000);
    }

    function resetAutoplay() {
        clearInterval(autoplayInterval);
        startAutoplay();
    }

    startAutoplay();
    let touchStartX = 0;
    let touchEndX = 0;

    if (testimonialTrack) {
        testimonialTrack.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        testimonialTrack.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) nextSlide();
                else prevSlide();
                resetAutoplay();
            }
        }, { passive: true });
    }
    const appointmentForm = document.getElementById('appointmentForm');
    const submitBtn = document.getElementById('submitBtn');
    const toast = document.getElementById('toast');
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    function validateField(field) {
        const group = field.closest('.form-group');
        if (!group) return true;
        
        let isValid = true;
        
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
        }
        
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = emailRegex.test(field.value);
        }
        
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^[+]?[\d\s-]{10,}$/;
            isValid = phoneRegex.test(field.value);
        }
        
        group.classList.toggle('error', !isValid);
        return isValid;
    }
    if (appointmentForm) {
        appointmentForm.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => {
                const group = field.closest('.form-group');
                if (group && group.classList.contains('error')) {
                    validateField(field);
                }
            });
        });

        appointmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const fields = appointmentForm.querySelectorAll('input[required], select[required]');
            let allValid = true;
            
            fields.forEach(field => {
                if (!validateField(field)) allValid = false;
            });
            
            if (!allValid) return;
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoader = submitBtn.querySelector('.btn-loader');
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-flex';
            submitBtn.disabled = true;
            const formData = {
                name: appointmentForm.querySelector('#patientName').value,
                phone: appointmentForm.querySelector('#patientPhone').value,
                email: appointmentForm.querySelector('#patientEmail').value,
                service: appointmentForm.querySelector('#serviceSelect').value,
                date: appointmentForm.querySelector('#appointmentDate').value,
                message: appointmentForm.querySelector('#patientMessage').value
            };

            fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(res => res.json())
            .then(data => {
                btnText.style.display = 'inline';
                btnLoader.style.display = 'none';
                submitBtn.disabled = false;

                if (data.success) {
                    showToast();
                    appointmentForm.reset();
                } else {
                    alert(data.error || 'Something went wrong. Please try again.');
                }
            })
            .catch(() => {
                btnText.style.display = 'inline';
                btnLoader.style.display = 'none';
                submitBtn.disabled = false;
                showToast();
                appointmentForm.reset();
            });
        });
    }
    function showToast() {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }

    const toastClose = toast ? toast.querySelector('.toast-close') : null;
    if (toastClose) {
        toastClose.addEventListener('click', () => {
            toast.classList.remove('show');
        });
    }
    const backToTop = document.getElementById('backToTop');

    function handleBackToTop() {
        if (window.scrollY > 600) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    }

    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            this.style.setProperty('--ripple-x', x + '%');
            this.style.setProperty('--ripple-y', y + '%');
        });
    });
    if (window.innerWidth > 1024) {
        const heroBg = document.querySelector('.hero-bg-img');
        window.addEventListener('scroll', () => {
            if (heroBg) {
                const scrollY = window.scrollY;
                heroBg.style.transform = `translateY(${scrollY * 0.3}px) scale(1.1)`;
            }
        }, { passive: true });
    }
    const bottomBarItems = document.querySelectorAll('.bottom-bar-item[href]');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY + 200;
        
        bottomBarItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && href.startsWith('#')) {
                const section = document.querySelector(href);
                if (section) {
                    const sectionTop = section.offsetTop;
                    const sectionHeight = section.offsetHeight;
                    
                    if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                        bottomBarItems.forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    }
                }
            }
        });
    }, { passive: true });
    if ('IntersectionObserver' in window) {
        const imgObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    imgObserver.unobserve(img);
                }
            });
        }, { rootMargin: '100px' });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imgObserver.observe(img);
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileNav();
        }
    });
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            const img = item.querySelector('img');
            if (!img) return;
            
            const lightbox = document.createElement('div');
            lightbox.style.cssText = `
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(11, 29, 58, 0.95);
                display: flex; align-items: center; justify-content: center;
                padding: 2rem; cursor: zoom-out;
                animation: fadeIn 0.3s ease;
            `;
            
            const lightboxImg = document.createElement('img');
            lightboxImg.src = img.src.replace(/w=\d+/, 'w=1200');
            lightboxImg.alt = img.alt;
            lightboxImg.style.cssText = `
                max-width: 90%; max-height: 90vh;
                object-fit: contain; border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                animation: zoomIn 0.3s ease;
            `;
            
            lightbox.appendChild(lightboxImg);
            document.body.appendChild(lightbox);
            document.body.style.overflow = 'hidden';
            
            lightbox.addEventListener('click', () => {
                lightbox.style.animation = 'fadeOut 0.2s ease forwards';
                setTimeout(() => {
                    document.body.removeChild(lightbox);
                    document.body.style.overflow = '';
                }, 200);
            });

            document.addEventListener('keydown', function handler(e) {
                if (e.key === 'Escape') {
                    lightbox.click();
                    document.removeEventListener('keydown', handler);
                }
            });
        });
    });
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(style);
    handleNavScroll();
    updateScrollProgress();

});
