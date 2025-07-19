document.addEventListener('DOMContentLoaded', () => {
    // ==================================================== //
    // |                 DOM ELEMENT REFERENCES             | //
    // ==================================================== //
    const chatHistoryList = document.getElementById('chat-history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageUploadInput = document.getElementById('image-upload-input');

    // For the future contextual chat popup
    // Note: The logic for this is complex and will be added in a later step.
    // This setup gets the elements ready.
    const contextualChatPopup = document.getElementById('contextual-chat-popup');
    const closePopupBtn = document.getElementById('close-popup-btn');
    const popupContextQuote = contextualChatPopup.querySelector('blockquote');

    // ==================================================== //
    // |                   STATE MANAGEMENT                 | //
    // ==================================================== //
    let chatHistory = []; // Array of all chat sessions: [{ id, title, messages: [{ role, content }] }]
    let currentChatId = null;
    let isAIGenerating = false;

    // ==================================================== //
    // |                  INITIALIZATION                  | //
    // ==================================================== //
    function initializeApp() {
        loadChatsFromLocalStorage();
        renderChatHistorySidebar();
        if (chatHistory.length > 0) {
            // Load the most recent chat by default
            switchChat(chatHistory[0].id);
        } else {
            startNewChat();
        }
        addEventListeners();
    }

    function addEventListeners() {
        chatForm.addEventListener('submit', handleSendMessage);
        messageInput.addEventListener('input', autoResizeTextarea);
        messageInput.addEventListener('keydown', handleEnterKey);
        newChatBtn.addEventListener('click', startNewChat);
        chatHistoryList.addEventListener('click', handleSidebarClick);
        imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
        // Add more listeners for edit, delete, regenerate, and contextual chat later
    }

    // ==================================================== //
    // |              CONVERSATION MANAGEMENT             | //
    // ==================================================== //
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
            messages: [] // Start with no messages
        };
        // Add to the beginning of the history array
        chatHistory.unshift(newChatSession);
        renderChatHistorySidebar();
        renderChatMessages(currentChatId);
        messageInput.focus();
    }

    function switchChat(chatId) {
        currentChatId = chatId;
        renderChatHistorySidebar();
        renderChatMessages(chatId);
    }
    
    // NOTE: A full delete implementation would need a confirmation dialog.
    // This is a simplified version.
    function deleteChat(chatId) {
        chatHistory = chatHistory.filter(chat => chat.id !== chatId);
        saveChatsToLocalStorage();
        renderChatHistorySidebar();
        
        // If the deleted chat was the current one, start a new chat or load another
        if (currentChatId === chatId) {
            if (chatHistory.length > 0) {
                switchChat(chatHistory[0].id);
            } else {
                startNewChat();
            }
        }
    }

    // ==================================================== //
    // |                  UI RENDERING                    | //
    // ==================================================== //
    function renderChatHistorySidebar() {
        chatHistoryList.innerHTML = '';
        chatHistory.forEach(chat => {
            const li = document.createElement('li');
            li.textContent = chat.title;
            li.dataset.chatId = chat.id;
            if (chat.id === currentChatId) {
                li.classList.add('active');
            }
            // Simple delete button for demonstration
            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = '🗑️';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.style.float = 'right';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.display = 'none'; // Hide by default
            li.addEventListener('mouseover', () => deleteBtn.style.display = 'inline');
            li.addEventListener('mouseout', () => deleteBtn.style.display = 'none');
            
            li.appendChild(deleteBtn);
            chatHistoryList.appendChild(li);
        });
    }

    function renderChatMessages(chatId) {
        chatMessages.innerHTML = '';
        const chat = chatHistory.find(c => c.id === chatId);
        if (!chat || chat.messages.length === 0) {
            // Display a welcome message for new/empty chats
            addMessageToUI('ai', 'Hello! How can I help you learn something new today?', false);
            return;
        }
        chat.messages.forEach(msg => addMessageToUI(msg.role, msg.content, false));
    }

    function addMessageToUI(role, content, isStreaming = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', `${role}-message-wrapper`);

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);

        if (role === 'ai' && isStreaming) {
            // Add typing indicator for streaming start
            messageDiv.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
        } else {
            // For non-streaming or completed messages, parse markdown
            messageDiv.innerHTML = marked.parse(content);
        }

        messageWrapper.appendChild(messageDiv);
        chatMessages.appendChild(messageWrapper);
        
        // Apply syntax highlighting to any new code blocks
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        // Scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv; // Return the element for streaming updates
    }

    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = `${messageInput.scrollHeight}px`;
    }

    // ==================================================== //
    // |                EVENT HANDLERS                    | //
    // ==================================================== //
    function handleSidebarClick(e) {
        if (e.target && e.target.matches('li')) {
            const chatId = e.target.dataset.chatId;
            switchChat(chatId);
        }
        if (e.target && e.target.matches('.delete-btn')) {
            e.stopPropagation(); // Prevent li click from firing
            const chatId = e.target.parentElement.dataset.chatId;
            if (confirm('Are you sure you want to delete this chat?')) {
                deleteChat(chatId);
            }
        }
    }
    
    function handleEnterKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit(); // Triggers the 'submit' event
        }
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        if (isAIGenerating) return;

        const userInput = messageInput.value.trim();
        if (!userInput) return;

        // Add user message to state and UI
        const currentChat = chatHistory.find(c => c.id === currentChatId);
        
        // If this is the first message, update the chat title
        if (currentChat.messages.length === 0) {
            currentChat.title = userInput.substring(0, 30) + '...';
            renderChatHistorySidebar(); // Update sidebar with new title
        }
        
        currentChat.messages.push({ role: 'user', content: userInput });
        addMessageToUI('user', userInput);
        saveChatsToLocalStorage();

        // Clear input and get AI response
        messageInput.value = '';
        autoResizeTextarea();
        await getAIResponse();
    }

    // ==================================================== //
    // |                 API COMMUNICATION                | //
    // ==================================================== //
    async function getAIResponse() {
        isAIGenerating = true;
        const aiMessageElement = addMessageToUI('ai', '', true); // Show typing indicator

        try {
            const currentChat = chatHistory.find(c => c.id === currentChatId);
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: currentChat.messages }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            aiMessageElement.innerHTML = ''; // Clear typing indicator

            // Stream the response
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;
                aiMessageElement.innerHTML = marked.parse(fullResponse);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            // Finalize the message
            aiMessageElement.querySelectorAll('pre code').forEach(hljs.highlightElement);
            currentChat.messages.push({ role: 'ai', content: fullResponse });
            saveChatsToLocalStorage();

        } catch (error) {
            console.error('Error fetching AI response:', error);
            aiMessageElement.innerHTML = "Sorry, I encountered an error. Please try again.";
        } finally {
            isAIGenerating = false;
        }
    }

    // ==================================================== //
    // |             FEATURE IMPLEMENTATIONS (WIP)        | //
    // ==================================================== //
    // The logic for these will be more complex. This is a placeholder.
    function handleTextSelection(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selection.anchorNode.parentElement.closest('.ai-message')) {
            // We have a selection inside an AI message!
            // This is where you would show your contextual popup.
            console.log("Selected AI text:", selectedText);
            // Example:
            // popupContextQuote.textContent = selectedText;
            // contextualChatPopup.classList.remove('hidden');
            alert(`Contextual Chat Triggered!\n\nSelected Text: "${selectedText}"\n\n(This feature's UI is not fully wired yet.)`);
        }
    }
    
    // Add the listener for the contextual chat feature
    chatMessages.addEventListener('mouseup', handleTextSelection);


    // Let's go!
    initializeApp();
});