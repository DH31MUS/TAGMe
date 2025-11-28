document.addEventListener('DOMContentLoaded', () => {
    
    // --- Lógica del Botón Compartir (Existente) ---
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', copiarAlPortapapeles);
    }

    function copiarAlPortapapeles() {
        const url = window.location.href;
        copiarTexto(url, "¡Enlace de perfil copiado!");
    }

    // --- Lógica de la Ventana Modal (Nueva) ---
    const modal = document.getElementById('infoModal');
    const triggers = document.querySelectorAll('.contact-trigger');
    const closeBtn = document.getElementById('closeModalBtn');
    const overlay = document.getElementById('modalOverlay');
    
    // Elementos dentro del modal para actualizar
    const modalTitle = document.getElementById('modalTitle');
    const modalValue = document.getElementById('modalValue');
    const modalIcon = document.getElementById('modalIcon');
    const modalActionBtn = document.getElementById('modalActionBtn');

    // Función para abrir modal con datos dinámicos
    triggers.forEach(button => {
        button.addEventListener('click', () => {
            // Leer datos del botón clickeado
            const type = button.getAttribute('data-type');
            const value = button.getAttribute('data-value');
            const iconClass = button.getAttribute('data-icon'); // ej: fa-envelope
            const actionLink = button.getAttribute('data-action');
            const actionText = button.getAttribute('data-action-text');

            // Insertar datos en el HTML del modal
            modalTitle.textContent = type;
            modalValue.textContent = value;
            
            // Actualizar icono (limpiar clases anteriores y poner las nuevas)
            modalIcon.className = ''; 
            modalIcon.classList.add('fas', iconClass ? iconClass : 'fa-info'); // Agrega fas y el icono específico
            // Alternativa si usas marcas (fab) para linkedin:
            if(iconClass.includes('linkedin')) {
                 modalIcon.classList.remove('fas');
                 modalIcon.classList.add('fab');
            }

            // Configurar botón de acción principal
            modalActionBtn.href = actionLink;
            modalActionBtn.textContent = actionText;

            // Mostrar modal
            modal.classList.remove('hidden');
        });
    });

    // Función para cerrar modal
    function closeModal() {
        modal.classList.add('hidden');
    }

    // Cerrar con botón o click afuera
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    // Cerrar con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Función global para copiar el texto dentro del modal
    window.copiarDatoModal = function() {
        const texto = document.getElementById('modalValue').textContent;
        copiarTexto(texto, "¡Dato copiado al portapapeles!");
    };

    // Helper genérico para copiar
    function copiarTexto(texto, mensajeExito) {
        const tempInput = document.createElement("input");
        tempInput.value = texto;
        document.body.appendChild(tempInput);
        tempInput.select();
        
        try {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(tempInput.value)
                    .then(() => alert(mensajeExito))
                    .catch(() => alert("No se pudo copiar"));
            } else {
                document.execCommand('copy');
                alert(mensajeExito);
            }
        } catch (err) {
            console.error(err);
        }
        document.body.removeChild(tempInput);
    }
});