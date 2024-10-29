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
    const initialState = document.getElementById('initialState');
    const errorState = document.getElementById('errorState');

    let currentResults = [];
    let currentAnalysis = null;
    let isLoading = false;

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });
    closeButton?.addEventListener('click', hideModal);
    modal?.addEventListener('click', e => {
        if (e.target === modal) hideModal();
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterResults(button.textContent.toLowerCase());
        });
    });

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query || isLoading) return;

        try {
            setLoading(true);
            hideElement(initialState);
            hideElement(resultsSection);
            hideElement(errorState);
            showElement(loadingSpinner);
            clearResults();

            const response = await fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            currentResults = results;

            // Add artificial delay for better Experience
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            hideElement(loadingSpinner);
            hideElement(initialState);
            showElement(resultsSection);
            
            if (results.length > 0) {
                showResultsWithAnimation(results);
            } else {
                showNoResults();
            }

        } catch (error) {
            console.error('Search error:', error);
            showError('An error occurred while searching. Please try again.');
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
                    <span>Detailed Analysis</span>
                </button>
            </div>
        `;

        return card;
    }

    // Video Analysis
    window.analyzeVideo = async function(videoId) {
        try {
            showModal();
            modalContent.innerHTML = `
                <div class="spinner">
                    <div class="spinner-ring"></div>
                    <p>Analyzing video...</p>
                </div>
            `;
            
   
            document.getElementById('downloadReport').style.display = 'none';

            const response = await fetch(`/analyze/${videoId}`);
            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            currentAnalysis = data.analysis;
            
            // Add small delay for loading state visibility
            await new Promise(resolve => setTimeout(resolve, 500));
            
            modalContent.innerHTML = `
                <div class="analysis-content">
                    <div class="analysis-section">
                        <h3>
                            <i class="fas fa-list-ul"></i>
                            Key Findings
                        </h3>
                        ${formatAnalysis(data.analysis)}
                    </div>
                </div>
            `;

            // Show download button after analysis is complete
            document.getElementById('downloadReport').style.display = 'flex';

        } catch (error) {
            modalContent.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to analyze video. Please try again.</p>
                </div>
            `;
            // To Hide download button on error
            document.getElementById('downloadReport').style.display = 'none';
            currentAnalysis = null;
        }
    };

    document.getElementById('downloadReport').addEventListener('click', async function() {
        if (!currentAnalysis) {
            alert('Please wait for the analysis to complete.');
            return;
        }

        try {
            const button = this;
            const buttonContent = button.querySelector('.button-content');
            const buttonLoader = button.querySelector('.button-loader');

            button.disabled = true;
            buttonContent.classList.add('hidden');
            buttonLoader.classList.remove('hidden');

            const response = await fetch('/generate-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysis: currentAnalysis
                })
            });

            if (!response.ok) throw new Error('Failed to generate report');

            const data = await response.json();
            
            const link = document.createElement('a');
            link.href = data.report_url;
            link.click();

        } catch (error) {
            console.error('Report generation error:', error);
            alert('Failed to generate report. Please try again.');
        } finally {
    
            const button = document.getElementById('downloadReport');
            const buttonContent = button.querySelector('.button-content');
            const buttonLoader = button.querySelector('.button-loader');
            
            button.disabled = false;
            buttonContent.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
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
        searchButton.disabled = loading;
        const buttonContent = searchButton.querySelector('.button-content');
        const buttonLoader = searchButton.querySelector('.button-loader');
        
        if (loading) {
            buttonContent.classList.add('hidden');
            buttonLoader.classList.remove('hidden');
        } else {
            buttonContent.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
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
        hideElement(loadingSpinner);
        hideElement(resultsSection);
        showElement(errorState);
        document.getElementById('errorMessage').textContent = message;
    }

    function showModal() {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        currentAnalysis = null;
        const button = document.getElementById('downloadReport');
        const buttonContent = button.querySelector('.button-content');
        const buttonLoader = button.querySelector('.button-loader');
        
        button.disabled = false;
        button.style.display = 'none';
        buttonContent.classList.remove('hidden');
        buttonLoader.classList.add('hidden');
    }

    function showElement(element) {
        element?.classList.remove('hidden');
    }

    function hideElement(element) {
        element?.classList.add('hidden');
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
        if (!text) return '';
        return text.split('\n').map(paragraph => 
            paragraph.trim() ? `<p>${paragraph}</p>` : ''
        ).join('');
    }
});