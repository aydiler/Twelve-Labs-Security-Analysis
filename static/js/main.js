document.addEventListener('DOMContentLoaded', function() {

    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsSection = document.getElementById('resultsSection');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const modal = document.getElementById('analysisModal');
    const modalContent = document.getElementById('analysisContent');
    const closeButton = document.querySelector('.close-button');
    const filterButtons = document.querySelectorAll('.filter-btn');

    let currentResults = [];
    let isLoading = false;

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });
    closeButton.addEventListener('click', () => hideModal());
    modal.addEventListener('click', e => {
        if (e.target === modal) hideModal();
    });

    initializeAnimations();

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query || isLoading) return;

        try {
            setLoading(true);
            clearResults();

            const response = await fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            currentResults = results;
            
            if (results.length > 0) {
                showResultsWithAnimation(results);
            } else {
                showNoResults();
            }

        } catch (error) {
            showError('An error occurred while searching. Please try again.');
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    }

 
    function showResultsWithAnimation(results) {
        resultsSection.style.display = 'block';
        
        results.forEach((result, index) => {
            setTimeout(() => {
                const card = createResultCard(result);
                resultsGrid.appendChild(card);
                
                // Fade in animation
                requestAnimationFrame(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
            }, index * 100);
        });
    }

    function createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.3s ease';

        const confidenceClass = getConfidenceClass(result.confidence);
        const confidenceIcon = getConfidenceIcon(result.confidence);

        card.innerHTML = `
            <div class="confidence-badge ${confidenceClass}">
                ${confidenceIcon}
                ${result.confidence} Confidence
            </div>
            <div class="result-content">
                <div class="result-score">
                    <i class="fas fa-chart-line"></i>
                    <span>Match Score: ${result.score}%</span>
                </div>
                <div class="result-time">
                    <i class="fas fa-clock"></i>
                    <span>${formatTimeRange(result.start, result.end)}</span>
                </div>
                <button class="analyze-btn" onclick="analyzeVideo('${result.video_id}')">
                    <i class="fas fa-microscope"></i>
                    Detailed Analysis
                </button>
            </div>
        `;

        return card;
    }


    window.analyzeVideo = async function(videoId) {
        try {
            showModal();
            setLoading(true);

            const response = await fetch(`/analyze/${videoId}`);
            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            
            modalContent.innerHTML = `
                <div class="analysis-content">
                    <div class="analysis-section">
                        <i class="fas fa-list-ul"></i>
                        <h3>Key Findings</h3>
                        ${formatAnalysis(data.analysis)}
                    </div>
                </div>
            `;

        } catch (error) {
            modalContent.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to analyze video. Please try again.</p>
                </div>
            `;
        } finally {
            setLoading(false);
        }
    };

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterResults(button.textContent.toLowerCase());
        });
    });

    function filterResults(filterType) {
        if (!currentResults.length) return;

        const filteredResults = currentResults.filter(result => {
            switch(filterType) {
                case 'high confidence':
                    return result.confidence.toLowerCase() === 'high';
                case 'recent':
                    return result.start < 60;
                default:
                    return true;
            }
        });

        clearResults();
        showResultsWithAnimation(filteredResults);
    }

    function setLoading(loading) {
        isLoading = loading;
        loadingSpinner.classList.toggle('hidden', !loading);
        searchButton.disabled = loading;
    }

    function clearResults() {
        resultsGrid.innerHTML = '';
    }

    function showNoResults() {
        resultsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No Results Found</h3>
                <p>Try different search terms or filters</p>
            </div>
        `;
    }

    function showError(message) {
        resultsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    function showModal() {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function formatTimeRange(start, end) {
        return `${formatTime(start)} - ${formatTime(end)}`;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function getConfidenceClass(confidence) {
        switch(confidence.toLowerCase()) {
            case 'high': return 'confidence-high';
            case 'medium': return 'confidence-medium';
            default: return 'confidence-low';
        }
    }

    function getConfidenceIcon(confidence) {
        switch(confidence.toLowerCase()) {
            case 'high': return '<i class="fas fa-check-circle"></i>';
            case 'medium': return '<i class="fas fa-exclamation-circle"></i>';
            default: return '<i class="fas fa-question-circle"></i>';
        }
    }

    function formatAnalysis(text) {
        return text.split('\n').map(paragraph => 
            paragraph.trim() ? `<p>${paragraph}</p>` : ''
        ).join('');
    }

    function initializeAnimations() {
        document.documentElement.style.scrollBehavior = 'smooth';

        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
            });
        });
    }
});