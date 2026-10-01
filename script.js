/**
 * WanderAI - Control Logic & Gemini API Integration
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- State Variables ---
    let apiKey = localStorage.getItem('wander_gemini_key') || '';
    let chatHistory = JSON.parse(localStorage.getItem('wander_chat_history')) || [];
    let currentStyle = 'general';
    let lastAiResponseText = '';

    // --- DOM Elements ---
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const validationMsg = document.getElementById('validation-msg');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const btnClearChat = document.getElementById('btn-clear-chat');
    const btnExportChat = document.getElementById('btn-export-chat');
    const activeModeLabel = document.getElementById('active-mode-label');
    const aiQuickActions = document.getElementById('ai-quick-actions');
    const btnSummarize = document.getElementById('btn-summarize');
    const selectTranslate = document.getElementById('select-translate');
    
    // Modals
    const modalConfig = document.getElementById('modal-config');
    const modalDoc = document.getElementById('modal-doc');
    const btnOpenConfig = document.getElementById('btn-open-config');
    const btnOpenDoc = document.getElementById('btn-open-doc');
    const apiKeyInput = document.getElementById('api-key-input');
    const btnSaveKey = document.getElementById('btn-save-key');

    // System Prompt for Tourist Assistant Context
    const SYSTEM_PROMPT = `Eres WanderAI, un asistente virtual experto en turismo mundial, viajes, itinerarios y cultura local. 
    Tu objetivo es ayudar a los usuarios a planificar viajes, recomendar lugares gastronómicos, alojamientos, documentación requerida y consejos de presupuesto.
    Responde con un tono amable, entusiasta, estructurado y claro usando Markdown (negritas, listas, emojis de viaje). 
    Si la consulta no está relacionada con turismo, responde amablemente reorientando la conversación al viaje.`;

    // Initialize App
    init();

    function init() {
        initTheme();
        initEventListeners();
        renderHistory();
        if (apiKey) apiKeyInput.value = apiKey;
    }

    // --- Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem('wander_theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    btnThemeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('wander_theme', isDark ? 'dark' : 'light');
        showToast(`Modo ${isDark ? 'Oscuro' : 'Claro'} activado`, 'info');
    });

    // --- Event Listeners ---
    function initEventListeners() {
        
        // Chat Submit Form
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleUserSubmit();
        });

        // Keypress enter on textarea
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUserSubmit();
            }
        });

        // Textarea Input validation clear
        userInput.addEventListener('input', () => {
            if (userInput.value.trim().length > 0) {
                validationMsg.classList.add('hidden');
            }
        });

        // Travel Style Buttons
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('border-brand-500', 'bg-brand-50/80', 'dark:bg-slate-700'));
                btn.classList.add('border-brand-500', 'bg-brand-50/80', 'dark:bg-slate-700');
                currentStyle = btn.dataset.style;
                
                const styleNames = {
                    mochilero: 'Mochilero / Low-Cost',
                    familiar: 'Familiar / Tranquilo',
                    aventura: 'Aventura & Naturaleza',
                    lujo: 'Lujo & Gourmet'
                };
                activeModeLabel.textContent = styleNames[currentStyle] || 'General';
                showToast(`Estilo de viaje fijado en: ${styleNames[currentStyle]}`, 'info');
            });
        });

        // Preset Prompts
        document.querySelectorAll('.prompt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                userInput.value = btn.dataset.prompt;
                handleUserSubmit();
            });
        });

        // Clear Chat History
        btnClearChat.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas borrar el historial de esta sesión?')) {
                chatHistory = [];
                localStorage.removeItem('wander_chat_history');
                chatMessagesContainer.innerHTML = '';
                addWelcomeMessage();
                aiQuickActions.classList.add('hidden');
                showToast('Historial borrado con éxito', 'success');
            }
        });

        // Export Chat
        btnExportChat.addEventListener('click', exportChatHistory);

        // Modals Controls
        btnOpenConfig.addEventListener('click', () => openModal(modalConfig));
        btnOpenDoc.addEventListener('click', () => openModal(modalDoc));
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(modalConfig);
                closeModal(modalDoc);
            });
        });

        // Save API Key
        btnSaveKey.addEventListener('click', () => {
            apiKey = apiKeyInput.value.trim();
            localStorage.setItem('wander_gemini_key', apiKey);
            closeModal(modalConfig);
            showToast('API Key guardada correctamente', 'success');
        });

        // AI Quick Actions
        btnSummarize.addEventListener('click', handleSummarize);
        selectTranslate.addEventListener('change', handleTranslate);
    }

    // --- Core Logic & Submission ---
    async function handleUserSubmit() {
        const query = userInput.value.trim();

        // Validation
        if (!query) {
            validationMsg.classList.remove('hidden');
            return;
        }

        validationMsg.classList.add('hidden');
        userInput.value = '';

        // Add user message to UI
        appendMessage('user', query);
        saveMessage('user', query);

        // Show Thinking Indicator
        const loadingDiv = showLoadingIndicator();

        // Process AI Response
        try {
            let responseText = '';
            if (apiKey) {
                responseText = await fetchGeminiResponse(query);
            } else {
                responseText = await simulateAiResponse(query);
            }

            removeLoadingIndicator(loadingDiv);
            appendMessage('assistant', responseText);
            saveMessage('assistant', responseText);
            
            lastAiResponseText = responseText;
            aiQuickActions.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            removeLoadingIndicator(loadingDiv);
            appendMessage('assistant', '⚠️ Hubo un error al procesar tu solicitud. Por favor verifica tu conexión o API Key.');
            showToast('Error de conexión con la IA', 'error');
        }
    }

    // --- Gemini API Call ---
    async function fetchGeminiResponse(userQuery) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
        
        const styleInstruction = currentStyle !== 'general' ? ` (Enfoca las recomendaciones para un viaje de estilo: ${currentStyle})` : '';

        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${SYSTEM_PROMPT}\n${styleInstruction}\nPregunta del usuario: ${userQuery}` }]
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    // --- Simulated Offline AI Motor ---
    function simulateAiResponse(query) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const q = query.toLowerCase();
                let response = "";

                if (q.includes("rio") || q.includes("brasil")) {
                    response = `### 🌴 Itinerario Recomendado en Río de Janeiro (3 Días)

**Día 1: Iconos e Historia**
* **Mañana:** Visita al **Cristo Redentor** temprano en la mañana para evitar colas.
* **Tarde:** Paseo en el teleférico del **Pan de Azúcar** y atardecer en **Praia Vermelha**.
* **Noche:** Cena en Botafogo con vista a la bahía.

**Día 2: Playas y Gastronomía**
* **Mañana:** Relax y caminata por las playas de **Ipanema** y **Copacabana**.
* **Tarde:** Probar una típica *Feijoada* en el barrio colonial de **Santa Teresa**.
* **Noche:** Demostración de Samba en vivo en *Lapa*.

**Día 3: Naturaleza Urbana**
* **Mañana:** Visita al **Jardín Botánico** y Parque Lage.
* **Tarde:** Recorrido por el Mural Etnias en el Puerto Maravilla.

💡 *Consejo:* Para este estilo (${currentStyle}), te recomiendo usar el metro para moverte seguro y rápido.`;
                } else if (q.includes("lima") || q.includes("peru") || q.includes("comida")) {
                    response = `### 🇵🇪 Guía Gastronómica de Lima, Perú

Lima es reconocida como la capital gastronómica de Latinoamérica. Aquí tienes los platillos imperdibles y lugares clave:

1. **Ceviche Tradicional:** Pescado fresco marinando en limón sutil, ají limo y cancha serrana. 
   * *Dónde probar:* Cevicheria La Mar o El Mercado.
2. **Lomo Saltado:** Salteado al wok de res, cebolla, tomate y papas fritas.
3. **Causa Limeña:** Masa de papa amarilla prensada con ají amarillo y relleno de pollo o cangrejo.
4. **Anticuchos:** Corazón de res marinado a las brasas.

🍹 **Para beber:** Un auténtico *Pisco Sour* en el Bar Inglés del Hotel Country Club.`;
                } else if (q.includes("requisito") || q.includes("europa") || q.includes("espana")) {
                    response = `### ✈️ Requisitos Generales para Viajar a Europa (Zona Schengen)

Para ciudadanos latinoamericanos que viajan por turismo (menos de 90 días):

* 🛂 **Pasaporte Válido:** Con al menos 3 meses de vigencia tras la fecha de salida proyectada.
* 🎫 **Pasaje de Regreso:** Boleto verificado de salida de la zona Schengen.
* 🏨 **Alojamiento:** Reserva de hotel confirmada o Carta de Invitación oficial.
* 💶 **Solvencia Económica:** Demostración de fondos suficientes (~100 EUR por día).
* 🏥 **Seguro Médico de Viaje:** Cobertura mínima de 30,000 EUR para emergencias médicas.`;
                } else {
                    response = `¡Excelente consulta sobre tu próximo viaje! 🗺️

Basado en tus preferencias (**Modo: ${currentStyle}**), te sugiero considerar lo siguiente:

1. **Mejor época:** Planifica tu viaje en temporada media (primavera u otoño) para obtener mejores precios y evitar grandes multitudes.
2. **Presupuesto y Alojamiento:** Reserva tu estancia con al menos 45 días de anticipación para asegurar tarifas accesibles.
3. **Experiencias recomendadas:** No olvides explorar los mercados locales y hacer un recorrido a pie (*free walking tour*) el primer día para orientarte.

¿Te gustaría que profundice en el presupuesto estimado o en las opciones de transporte interno?`;
                }

                resolve(response);
            }, 1200);
        });
    }

    // --- UI Rendering Helpers ---
    function appendMessage(role, text) {
        const isUser = role === 'user';
        const msgWrapper = document.createElement('div');
        msgWrapper.className = `flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`;

        const avatar = document.createElement('div');
        avatar.className = `w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
            isUser ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-brand-600 text-white'
        }`;
        avatar.innerHTML = isUser ? '<i class="fa-solid fa-user text-sm"></i>' : '<i class="fa-solid fa-robot text-sm"></i>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'space-y-1 max-w-full';

        const bubble = document.createElement('div');
        bubble.className = `p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isUser 
                ? 'bg-brand-600 text-white rounded-tr-none' 
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-700 prose-ai'
        }`;

        if (isUser) {
            bubble.textContent = text;
        } else {
            bubble.innerHTML = marked.parse(text);
        }

        const timestamp = document.createElement('span');
        timestamp.className = `text-[10px] text-slate-400 block px-1 ${isUser ? 'text-right' : ''}`;
        timestamp.textContent = `${isUser ? 'Tú' : 'Asistente IA'} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        contentDiv.appendChild(bubble);
        contentDiv.appendChild(timestamp);

        msgWrapper.appendChild(avatar);
        msgWrapper.appendChild(contentDiv);

        chatMessagesContainer.appendChild(msgWrapper);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'flex gap-4 max-w-3xl id-loading';
        loadingDiv.innerHTML = `
            <div class="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <i class="fa-solid fa-compass animate-spin"></i>
            </div>
            <div class="bg-slate-100 dark:bg-slate-700/60 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Diseñando tu viaje</span>
                <div class="flex gap-1">
                    <span class="w-1.5 h-1.5 bg-brand-500 rounded-full typing-dot"></span>
                    <span class="w-1.5 h-1.5 bg-brand-500 rounded-full typing-dot"></span>
                    <span class="w-1.5 h-1.5 bg-brand-500 rounded-full typing-dot"></span>
                </div>
            </div>
        `;
        chatMessagesContainer.appendChild(loadingDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return loadingDiv;
    }

    function removeLoadingIndicator(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    // --- Extra Features: Resumen & Traducción ---
    async function handleSummarize() {
        if (!lastAiResponseText) return;
        const prompt = `Por favor, genera un resumen en 3 puntos clave de la siguiente recomendación de viaje:\n\n${lastAiResponseText}`;
        userInput.value = "Genera un resumen clave de la última respuesta.";
        handleUserSubmit();
    }

    async function handleTranslate(e) {
        const targetLang = e.target.value;
        if (!targetLang || !lastAiResponseText) return;
        
        userInput.value = `Traduce la última respuesta detallada al idioma: ${targetLang}.`;
        handleUserSubmit();
        e.target.value = '';
    }

    // --- Persistencia & Exportación ---
    function saveMessage(role, text) {
        chatHistory.push({ role, text, timestamp: new Date().toISOString() });
        localStorage.setItem('wander_chat_history', JSON.stringify(chatHistory));
    }

    function renderHistory() {
        if (chatHistory.length > 0) {
            chatMessagesContainer.innerHTML = '';
            chatHistory.forEach(msg => appendMessage(msg.role, msg.text));
            const lastAssistantMsg = chatHistory.filter(m => m.role === 'assistant').pop();
            if (lastAssistantMsg) {
                lastAiResponseText = lastAssistantMsg.text;
                aiQuickActions.classList.remove('hidden');
            }
        }
    }

    function exportChatHistory() {
        if (chatHistory.length === 0) {
            showToast('No hay historial para exportar', 'error');
            return;
        }

        let exportText = "# WanderAI - Historial de Consulta de Viajes\n\n";
        chatHistory.forEach(msg => {
            const sender = msg.role === 'user' ? 'Usuario' : 'Asistente IA';
            exportText += `### [${sender}] - ${new Date(msg.timestamp).toLocaleString()}\n${msg.text}\n\n---\n\n`;
        });

        const blob = new Blob([exportText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WanderAI_Historial_${new Date().toISOString().slice(0,10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Historial descargado en formato Markdown', 'success');
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        const bgColors = {
            info: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
            success: 'bg-emerald-600 text-white',
            error: 'bg-rose-600 text-white'
        };

        toast.className = `px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 pointer-events-auto transition-all transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
        toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${message}</span>`;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Modal Helpers ---
    function openModal(modal) {
        modal.classList.remove('pointer-events-none', 'opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
        modal.firstElementChild.classList.add('scale-100');
    }

    function closeModal(modal) {
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.firstElementChild.classList.remove('scale-100');
        modal.firstElementChild.classList.add('scale-95');
    }

    function addWelcomeMessage() {
        appendMessage('assistant', '¡Hola! 👋 Soy tu **Asistente Virtual de Viajes y Turismo**.\n\n¿A dónde te gustaría viajar o qué destino quieres explorar? Puedo armarte un itinerario día por día, buscar la mejor gastronomía local o darte consejos de presupuesto.');
    }
});
