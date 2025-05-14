

const translator = async (text, source, target) => {
    try {
        const response = await fetch(`https://libretranslate.de/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: text,
                source: source || 'auto',
                target: target,
                format: 'text'
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.translatedText;
        } else {
            throw new Error('Erreur lors de la traduction');
        }
    } catch (error) {
        console.error('Erreur lors de la traduction :', error);
        throw error;
    }
};

module.exports = { translator };