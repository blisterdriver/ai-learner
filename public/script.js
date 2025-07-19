document.addEventListener('DOMContentLoaded', () => {
    // (DOM element references remain the same)
    const chatHistoryList = document.getElementById('chat-history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const sendBtn = document.getElementById('send-btn');

    // (State management remains the same)
    let chatHistory = [];
    let currentChatId = null;
    let isAIGenerating = false;
    let uploadedImages = [];

    // === CHANGED: ADDED NEW EVENT LISTENER FOR DELETE ===
    function addEventListeners() {
        chatForm.addEventListener('submit', handleSendMessage);
        messageInput.addEventListener('input', () => {
            autoResizeTextarea();
            updateSendButtonState();
        });
        messageInput.addEventListener('keydown', handleEnterKey);
        newChatBtn.addEventListener('click', startNewChat);
        chatHistoryList.addEventListener('click', handleSidebarClick);
        imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
        imageUploadInput.addEventListener('change', handleImageUpload);
        imagePreviewContainer.addEventListener('click', handleRemoveImage);
        chatMessages.addEventListener('mouseup', handleTextSelection);
        
        // New listener for delete buttons, using event delegation
        chatMessages.addEventListener('click', handleMessageActions);
    }
    
    // === CHANGED: MODIFIED TO ADD DELETE BUTTON AND MESSAGE INDEX ===
    function addMessageToUI(message, isStreaming = false, index = -1) {
        const { role, parts } = message;
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', `${role}-message-wrapper`);
        // Add a data attribute to identify the message index for deletion
        if (index !== -1) {
            messageWrapper.dataset.messageIndex = index;
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);

        // Add the delete button HTML
        const deleteBtnHTML = `<button class="delete-msg-btn" title="Delete message">×</button>`;
        
        let contentHTML = '';
        if (role === 'ai' && isStreaming) {
            contentHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        } else {
            parts.forEach(part => {
                if (part.type === 'text') {
                    contentHTML += marked.parse(part.text);
                } else if (part.type === 'image') {
                    contentHTML += `<div class="sent-image-container"><img src="${part.data}" alt="User uploaded image"></div>`;
                }
            });
        }
        messageDiv.innerHTML = contentHTML;

        messageWrapper.appendChild(messageDiv);
        // Only add delete button to non-streaming, saved messages
        if (!isStreaming) {
            messageWrapper.innerHTML += deleteBtnHTML;
        }
        chatMessages.appendChild(messageWrapper);
        
        messageDiv.querySelectorAll('pre code').forEach(hljs.highlightElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }
    
    // === CHANGED: RENDER MESSAGES WITH THEIR INDEX ===
    function renderChatMessages(chatId) {
        chatMessages.innerHTML = '';
        const chat = chatHistory.find(c => c.id === chatId);
        if (!chat || chat.messages.length === 0) {
            // Can't delete the initial welcome message, so no index needed
            addMessageToUI({ role: 'ai', parts: [{ type: 'text', text: 'Hello! How can I help you learn something new today?' }] });
            return;
        }
        // Pass the index to addMessageToUI
        chat.messages.forEach((msg, index) => addMessageToUI(msg, false, index));
    }

    // === NEW: HANDLER FOR DELETE BUTTON CLICKS ===
    function handleMessageActions(e) {
        if (e.target.classList.contains('delete-msg-btn')) {
            const messageWrapper = e.target.closest('.message-wrapper');
            const messageIndex = parseInt(messageWrapper.dataset.messageIndex, 10);
            
            if (confirm('Are you sure you want to delete this message?')) {
                const currentChat = chatHistory.find(c => c.id === currentChatId);
                if (currentChat && currentChat.messages[messageIndex]) {
                    // Remove the message from the array
                    currentChat.messages.splice(messageIndex, 1);
                    saveChatsToLocalStorage();
                    // Re-render the chat to reflect the deletion
                    renderChatMessages(currentChatId);
                }
            }
        }
    }
    
    // === CHANGED: IMPROVED ERROR HANDLING IN API CALL ===
    async function getAIResponse(images) {
        isAIGenerating = true;
        const aiMessageElement = addMessageToUI({ role: 'ai', parts: [] }, true);

        try {
            // ... (The try block content remains the same)
            const currentChat = chatHistory.find(c => c.id === currentChatId);
            const apiMessages = currentChat.messages.map(msg => {
                const apiParts = msg.parts.map(part => {
                    if (part.type === 'text') return { text: part.text };
                    if (part.type === 'image') return { inline_data: { mime_type: part.mimeType, data: part.data.split(',')[1] } };
                }).filter(Boolean);
                return { role: msg.role === 'ai' ? 'model' : 'user', parts: apiParts };
            });

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                // Throw a more detailed error
                throw new Error(`API Error (${response.status}): ${errorBody}`);
            }
            
            // ... (The rest of the try block remains the same)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            aiMessageElement.innerHTML = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullResponse += decoder.decode(value, { stream: true });
                aiMessageElement.innerHTML = marked.parse(fullResponse);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            aiMessageElement.querySelectorAll('pre code').forEach(hljs.highlightElement);
            currentChat.messages.push({ role: 'ai', parts: [{ type: 'text', text: fullResponse }] });
            saveChatsToLocalStorage();
            // Re-render to add delete button to the new AI message
            renderChatMessages(currentChatId);

        } catch (error) {
            // Now displays a more helpful error message
            console.error('Error fetching AI response:', error);
            const errorMessage = `Sorry, an error occurred. Check the developer console for details. (Error: ${error.message})`;
            aiMessageElement.innerHTML = marked.parse(errorMessage);
        } finally {
            isAIGenerating = false;
        }
    }

    // --- The rest of your script.js can remain as it was ---
    // (initializeApp, loadChatsFromLocalStorage, saveChatsToLocalStorage, etc.)
    // Just ensure the changed functions above replace the old ones.
    
    // For clarity, here are the functions that did not change significantly
    function initializeApp() {
        loadChatsFromLocalStorage();
        renderChatHistorySidebar();
        if (chatHistory.length > 0) {
            switchChat(chatHistory[0].id);
        } else {
            startNewChat();
        }
        addEventListeners();
        updateSendButtonState();
    }

    function loadChatsFromLocalStorage() {
        const storedChats = localStorage.getItem('ai-chat-history');
        chatHistory = storedChats ? JSON.parse(storedChats) : [];
    }

    function saveChatsToLocalStorage() {
        localStorage.setItem('ai-chat-history', JSON.stringify(chatHistory));
    }

    function startNewChat() {
        currentChatId = `chat_${Date.now()}`;
        const newChatSession = {
            id: currentChatId,
            title: 'New Chat',
            messages: []
        };
        chatHistory.unshift(newChatSession);
        clearInputs();
        renderChatHistorySidebar();
        renderChatMessages(currentChatId);
        messageInput.focus();
    }

    function switchChat(chatId) {
        currentChatId = chatId;
        clearInputs();
        renderChatHistorySidebar();
        renderChatMessages(chatId);
    }
    
    function deleteChat(chatId) {
        chatHistory = chatHistory.filter(chat => chat.id !== chatId);
        saveChatsToLocalStorage();
        renderChatHistorySidebar();
        if (currentChatId === chatId) {
            chatHistory.length > 0 ? switchChat(chatHistory[0].id) : startNewChat();
        }
    }

    function clearInputs() {
        messageInput.value = '';
        uploadedImages = [];
        imageUploadInput.value = '';
        renderImagePreviews();
        autoResizeTextarea();
        updateSendButtonState();
    }

    function renderChatHistorySidebar() {
        chatHistoryList.innerHTML = '';
        chatHistory.forEach(chat => {
            const li = document.createElement('li');
            li.textContent = chat.title;
            li.dataset.chatId = chat.id;
            if (chat.id === currentChatId) li.classList.add('active');
            
            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = '🗑️';
            deleteBtn.className = 'delete-btn';
            deleteBtn.style.cssText = 'float: right; cursor: pointer; display: none;';
            li.addEventListener('mouseover', () => deleteBtn.style.display = 'inline');
            li.addEventListener('mouseout', () => deleteBtn.style.display = 'none');
            
            li.appendChild(deleteBtn);
            chatHistoryList.appendChild(li);
        });
    }

    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${messageInput.scrollHeight}px`;
    }
    
    function updateSendButtonState() {
        sendBtn.classList.toggle('active', messageInput.value.trim().length > 0);
    }

    function handleImageUpload(e) {
        const files = e.target.files;
        if (!files) return;
        if (uploadedImages.length + files.length > 10) {
            alert('You can upload a maximum of 10 images.');
            return;
        }
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (event) => {
                uploadedImages.push({
                    mimeType: file.type,
                    data: event.target.result
                });
                renderImagePreviews();
            };
            reader.readAsDataURL(file);
        }
    }

    function renderImagePreviews() {
        imagePreviewContainer.innerHTML = '';
        uploadedImages.forEach((image, index) => {
            const thumbWrapper = document.createElement('div');
            thumbWrapper.className = 'image-thumbnail';
            const img = document.createElement('img');
            img.src = image.data;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image-btn';
            removeBtn.innerHTML = '×';
            removeBtn.dataset.index = index;
            thumbWrapper.appendChild(img);
            thumbWrapper.appendChild(removeBtn);
            imagePreviewContainer.appendChild(thumbWrapper);
        });
    }

    function handleRemoveImage(e) {
        if (e.target.classList.contains('remove-image-btn')) {
            const indexToRemove = parseInt(e.target.dataset.index, 10);
            uploadedImages.splice(indexToRemove, 1);
            renderImagePreviews();
        }
    }
    
    function handleSidebarClick(e) {
        const li = e.target.closest('li');
        if (li) {
            if (e.target.classList.contains('delete-btn')) {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this chat?')) {
                    deleteChat(li.dataset.chatId);
                }
            } else {
                switchChat(li.dataset.chatId);
            }
        }
    }
    
    function handleEnterKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit();
        }
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        if (isAIGenerating) return;

        const userInput = messageInput.value.trim();
        if (!userInput && uploadedImages.length === 0) return;

        const currentChat = chatHistory.find(c => c.id === currentChatId);
        
        const userMessage = { role: 'user', parts: [] };
        if (userInput) {
            userMessage.parts.push({ type: 'text', text: userInput });
        }
        uploadedImages.forEach(img => {
            userMessage.parts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
        });

        if (currentChat.messages.length === 0 && userInput) {
            currentChat.title = userInput.substring(0, 30) + (userInput.length > 30 ? '...' : '');
            renderChatHistorySidebar();
        }
        currentChat.messages.push(userMessage);
        
        // Render immediately to show user message
        renderChatMessages(currentChatId);
        saveChatsToLocalStorage();
        
        const imagesForAPI = [...uploadedImages];
        clearInputs();

        await getAIResponse(imagesForAPI);
    }

    function handleTextSelection(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selection.anchorNode.parentElement.closest('.ai-message')) {
            alert(`Contextual Chat Triggered!\n\nSelected Text: "${selectedText}"\n\n(This feature's UI can now be fully implemented.)`);
        }
    }

    initializeApp();
});