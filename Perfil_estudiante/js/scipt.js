document.addEventListener('DOMContentLoaded', () => {
    
    const shareBtn = document.getElementById('shareBtn');

    if (shareBtn) {
        shareBtn.addEventListener('click', copiarAlPortapapeles);
    }

    function copiarAlPortapapeles() {
        const url = window.location.href;
        
        // Creamos un elemento temporal
        const tempInput = document.createElement("input");
        tempInput.value = "¡Mira mi perfil digital! " + url; // Texto a compartir
        document.body.appendChild(tempInput);
        tempInput.select();
        
        try {
            // Método moderno si está disponible, fallback al antiguo
            if (navigator.clipboard) {
                navigator.clipboard.writeText(tempInput.value)
                    .then(() => alert("¡Enlace copiado al portapapeles!"))
                    .catch(() => alert("No se pudo copiar el enlace"));
            } else {
                document.execCommand('copy');
                alert("¡Enlace copiado al portapapeles!");
            }
        } catch (err) {
            console.error('Error al copiar:', err);
            alert("No se pudo copiar el enlace");
        }
        
        document.body.removeChild(tempInput);
    }
});