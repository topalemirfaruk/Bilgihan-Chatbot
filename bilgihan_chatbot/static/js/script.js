// Global değişkenler
let currentChatId = null;
let isAuthenticated = false;
let selectedCategory = null;

document.addEventListener('DOMContentLoaded', () => {
    // Elementleri başlat
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const messagesContainer = document.getElementById('messages');
    const welcomeScreen = document.getElementById('welcome-screen');
    const chatInterface = document.getElementById('chat-interface');
    const newChatButton = document.querySelector('.new-chat-btn');
    
    // Kategori seçimini başlat
    const categoryButtons = document.querySelectorAll('.category-btn');
    const activeCategoryBadge = document.createElement('div');
    activeCategoryBadge.className = 'active-category-badge';
    document.body.appendChild(activeCategoryBadge);

    // Kategori seçimini yönet
    categoryButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Tüm butonlardan aktif sınıfını kaldır
            categoryButtons.forEach(b => b.classList.remove('active'));
            
            // Seçilen butona aktif sınıfını ekle
            this.classList.add('active');
            
            selectedCategory = this.dataset.category;
            const categoryIcon = this.querySelector('i').className;
            const categoryName = this.querySelector('i').nextSibling.textContent;
            
            // Aktif kategori rozetini güncelle
            activeCategoryBadge.innerHTML = `<i class="${categoryIcon}"></i>${categoryName}`;
            activeCategoryBadge.style.display = 'block';
            
            // Hoşgeldiniz ekranını gizle ve sohbet arayüzünü göster
            welcomeScreen.style.display = 'none';
            chatInterface.style.display = 'flex';

            // Sohbet mesajlarını temizle
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            // Kategoriye göre sohbet placeholder'ını güncelle
            const placeholders = {
                health: 'Sağlık sorunuzu sorun...',
                science: 'Bilimsel merakınızı paylaşın...',
                technology: 'Teknoloji sorunuzu sorun...',
                ai: 'Yapay zeka hakkında sorunuzu sorun...'
            };
            userInput.placeholder = placeholders[selectedCategory] || 'Sorunuzu yazın...';
            
            // Giriş alanına odaklan
            userInput.focus();
            
            // Mobil cihazlarda, kategori seçildikten sonra kenar çubuğunu kapat
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    });

    // Hata ayıklama günlüğü
    console.log('DOM İçeriği Yüklendi');
    
    // Mesajı backend'e gönder
    async function sendMessage(message) {
        console.log('Mesaj gönderiliyor:', message); // Debug log
        try {
            const formData = new FormData();
            formData.append('message', message);
            formData.append('category', selectedCategory || 'health');
            if (currentChatId) {
                formData.append('chat_id', currentChatId);
            }

            console.log('Form verisi:', {
                message,
                category: selectedCategory,
                chat_id: currentChatId
            }); // Debug log

            const response = await fetch('/api/chat', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            console.log('Sunucu yanıtı:', response.status); // Debug log

            if (!response.ok) {
                throw new Error(`HTTP hatası! durum: ${response.status}`);
            }

            const data = await response.json();
            console.log('Alınan veri:', data); // Debug log

            if (!data || !data.response) {
                throw new Error('Geçersiz yanıt formatı');
            }

            return data;
        } catch (error) {
            console.error('Hata detayı:', error); // Debug log
            throw error;
        }
    }

    // Mesaj gönderimini yönet
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Kullanıcı giriş yapmış mı kontrol et
        const isAuthenticated = document.querySelector('.auth-btn.logout') !== null;
        if (!isAuthenticated) {
            showToast('Lütfen önce giriş yapın veya kayıt olun');
            return;
        }
        
        const message = userInput.value.trim();
        if (!message) return;
        
        if (!selectedCategory) {
            showToast('Lütfen önce bir kategori seçin');
            return;
        }

        // Gönderme butonunu devre dışı bırak ve yükleniyor animasyonunu göster
        sendButton.disabled = true;
        sendButton.classList.add('loading');
        
        try {
            // Kullanıcı mesajını göster
            appendMessage(message, false);
            
            // Mesajı temizle ve textarea'yı küçült
            userInput.value = '';
            adjustTextareaHeight();
            
            // Yanıtı al
            const response = await sendMessage(message);
            
            if (response && response.response) {
                // Bot yanıtını göster
                appendMessage(response.response, true);
                
                // Sohbet ID'sini güncelle
                if (response.chat_id) {
                    currentChatId = response.chat_id;
                }
            }
        } catch (error) {
            console.error('Hata:', error);
            if (error.message.includes('401')) {
                showToast('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showToast('Bir hata oluştu. Lütfen tekrar deneyin.');
            }
        } finally {
            // Gönderme butonunu tekrar aktif et ve yükleniyor animasyonunu kaldır
            sendButton.disabled = false;
            sendButton.classList.remove('loading');
            
            // En alta kaydır
            scrollToBottom();
        }
    });

    // Yeni sohbet butonuna tıklama olayını yönet
    newChatButton.addEventListener('click', () => {
        // Geçerli sohbet kimliğini sıfırla
        currentChatId = null;
        
        // Sohbet mesajlarını temizle
        messagesContainer.innerHTML = '';
        
        // Hoşgeldiniz ekranını gizle ve sohbet arayüzünü göster
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (chatInterface) chatInterface.style.display = 'flex';
        
        // Giriş alanına odaklan
        userInput.focus();
    });

    // Sohbet geçmişini görüntüle
    function displayChatHistory(chats) {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';

        if (!chats || chats.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state';
            emptyMessage.textContent = 'Henüz sohbet geçmişi bulunmuyor';
            messagesContainer.appendChild(emptyMessage);
            return;
        }

        chats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = 'chat-item';
            
            const chatHeader = document.createElement('div');
            chatHeader.className = 'chat-header';
            chatHeader.innerHTML = `
                <h3>${chat.title || 'Sohbet ' + chat.id}</h3>
                <span class="chat-date">${new Date(chat.created_at).toLocaleDateString('tr-TR')}</span>
            `;
            
            const messagesDiv = document.createElement('div');
            messagesDiv.className = 'chat-messages';
            
            chat.messages.forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${message.is_bot ? 'bot' : 'user'}`;
                messageDiv.textContent = message.content;
                messagesDiv.appendChild(messageDiv);
            });
            
            chatDiv.appendChild(chatHeader);
            chatDiv.appendChild(messagesDiv);
            messagesContainer.appendChild(chatDiv);
        });
    }

    // Sohbet geçmişini yükle
    async function loadChatHistory() {
        try {
            const response = await fetch('/api/chat-history', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error('Sohbet geçmişi yüklenirken bir hata oluştu');
            }

            const data = await response.json();
            displayChatHistory(data.chats);
        } catch (error) {
            console.error('Sohbet geçmişi hatası:', error);
            showToast(error.message);
        }
    }

    // Sohbet geçmişi butonuna tıklama olayını yönet
    const chatHistoryBtn = document.getElementById('chat-history-btn');
    if (chatHistoryBtn) {
        chatHistoryBtn.addEventListener('click', () => {
            loadChatHistory();
            
            // Hoşgeldiniz ekranını gizle ve sohbet arayüzünü göster
            const welcomeScreen = document.getElementById('welcome-screen');
            const chatInterface = document.getElementById('chat-interface');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (chatInterface) chatInterface.style.display = 'flex';
        });
    }

    // Sohbet geçmişi butonuna tıklama olayını yönet
    document.querySelector('.nav-section a[href="#"]').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/chat-history', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (response.status === 401) {
                showToast('Lütfen önce giriş yapın');
                return;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Sohbet geçmişi yüklenirken bir hata oluştu');
            }

            // Hoşgeldiniz ekranını gizle
            const welcomeScreen = document.getElementById('welcome-screen');
            const chatInterface = document.getElementById('chat-interface');
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (chatInterface) chatInterface.style.display = 'flex';

            displayChatHistory(data.chats);
        } catch (error) {
            console.error('Hata:', error);
            showToast(error.message || 'Sohbet geçmişi yüklenirken bir hata oluştu');
        }
    });

    // Textarea yüksekliğini ayarla
    userInput.addEventListener('input', adjustTextareaHeight);

    // Enter tuşuna basma olayını yönet
    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    }

    // Mesajı sohbete ekle
    function appendMessage(content, isBot) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isBot ? 'message bot-message' : 'message user-message';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = content;
        messageDiv.appendChild(textDiv);
        
        if (isBot) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const saveButton = document.createElement('button');
            saveButton.className = 'save-response-btn';
            saveButton.innerHTML = '<i class="fas fa-bookmark"></i>';
            saveButton.title = 'Bu yanıtı kaydet';
            saveButton.addEventListener('click', () => {
                console.log('Kaydet butonuna tıklandı');
                saveResponse(content);
            });
            
            actionsDiv.appendChild(saveButton);
            messageDiv.appendChild(actionsDiv);
        }
        
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    // Sohbeti en alta kaydır
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Bildirim göster
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Öneri tıklamalarını yönet
    window.sendSuggestion = function(text) {
        userInput.value = text;
        chatForm.dispatchEvent(new Event('submit'));
        welcomeScreen.style.display = 'none';
        chatInterface.style.display = 'flex';
    };

    // Mobil menü yöneticileri
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const closeSidebar = document.querySelector('.close-sidebar');

    if (menuToggle && sidebar && closeSidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
        });

        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    // Başlat
    adjustTextareaHeight();

    // Kaydedilen yanıtlar butonuna tıklama olayını yönet
    const savedResponsesBtn = document.getElementById('saved-responses-btn');
    if (savedResponsesBtn) {
        savedResponsesBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/saved-responses', {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    throw new Error(`HTTP hatası! durum: ${response.status}`);
                }

                // Yanıtın JSON olup olmadığını kontrol et
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Sunucudan beklenmeyen yanıt türü alındı!");
                }

                const responses = await response.json();
                displaySavedResponses(responses);
            } catch (error) {
                console.error('Hata:', error);
                showToast(error.message || 'Kaydedilen yanıtlar yüklenirken bir hata oluştu');
            }
        });
    }

    // Yanıtı kaydet
    async function saveResponse(content) {
        try {
            const formData = new FormData();
            formData.append('content', content);

            const response = await fetch('/api/saved-responses', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP hatası! durum: ${response.status}`);
            }

            // Yanıtın JSON olup olmadığını kontrol et
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Sunucudan beklenmeyen yanıt türü alındı!");
            }

            const data = await response.json();
            showToast('Yanıt başarıyla kaydedildi');
            return data;
        } catch (error) {
            console.error('Hata:', error);
            showToast(error.message || 'Yanıt kaydedilirken bir hata oluştu');
            throw error;
        }
    }

    // Kaydedilen yanıtı sil
    async function deleteSavedResponse(id) {
        try {
            const response = await fetch(`/api/saved-responses?id=${id}`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP hatası! durum: ${response.status}`);
            }

            // Yanıtın JSON olup olmadığını kontrol et
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Sunucudan beklenmeyen yanıt türü alındı!");
            }

            const data = await response.json();
            showToast('Yanıt başarıyla silindi');
            
            // Kaydedilen yanıtlar listesini yenile
            document.getElementById('saved-responses-btn').click();
        } catch (error) {
            console.error('Hata:', error);
            showToast(error.message || 'Yanıt silinirken bir hata oluştu');
        }
    }

    // Kaydedilen yanıtları görüntüle
    function displaySavedResponses(responses) {
        console.log('Kaydedilen yanıtları görüntüleme:', responses);
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';

        if (!responses || responses.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state';
            emptyMessage.textContent = 'Henüz kaydedilmiş yanıt bulunmuyor';
            messagesContainer.appendChild(emptyMessage);
            return;
        }

        const savedResponsesContainer = document.createElement('div');
        savedResponsesContainer.className = 'saved-responses-container';

        responses.forEach(response => {
            const responseDiv = document.createElement('div');
            responseDiv.className = 'saved-response';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'saved-response-content';
            contentDiv.textContent = response.content;
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-response-btn';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.addEventListener('click', () => deleteSavedResponse(response.id));
            
            responseDiv.appendChild(contentDiv);
            responseDiv.appendChild(deleteButton);
            savedResponsesContainer.appendChild(responseDiv);
        });

        messagesContainer.appendChild(savedResponsesContainer);
    }

    // Modal yöneticileri
    const loginBtn = document.querySelector('.auth-btn.login');
    const registerBtn = document.querySelector('.auth-btn.register');

    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            window.location.href = '/login';
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            window.location.href = '/register';
        });
    }
});
