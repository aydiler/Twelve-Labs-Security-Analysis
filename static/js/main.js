document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        searchInput: document.getElementById('searchInput'),
        searchButton: document.getElementById('searchButton'),
        resultsGrid: document.getElementById('resultsGrid'),
        resultsSection: document.getElementById('resultsSection'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        modal: document.getElementById('analysisModal'),
        modalContent: document.getElementById('analysisContent'),
        closeButton: document.querySelector('.close-button'),
        downloadBtn: document.querySelector('.download-button'),
        errorState: document.getElementById('errorState'),
        retryButton: document.querySelector('.retry-btn')
    };

    // State Management
    const state = {
        currentResults: [],
        currentAnalysis: null,
        isLoading: false,
        isGeneratingReport: false
    };

    // Event Listeners
    elements.searchButton?.addEventListener('click', handleSearch);
    elements.searchInput?.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.closeButton?.addEventListener('click', hideModal);
    elements.modal?.addEventListener('click', e => {
        if (e.target === elements.modal) hideModal();
    });
    elements.retryButton?.addEventListener('click', handleSearch);
    elements.downloadBtn?.addEventListener('click', handleDownload);

    // Search Handler
    async function handleSearch() {
        const query = elements.searchInput.value.trim();
        if (!query || state.isLoading) return;

        try {
            setLoading(true);
            hideElement(elements.resultsSection);
            hideElement(elements.errorState);
            showElement(elements.loadingSpinner);
            clearResults();

            const response = await fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            state.currentResults = results;
            
            hideElement(elements.loadingSpinner);
            showElement(elements.resultsSection);
            
            results.length > 0 ? displayResults(results) : showNoResults();

        } catch (error) {
            console.error('Search error:', error);
            showError('An error occurred while searching. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Display Results
    function displayResults(results) {
        elements.resultsGrid.innerHTML = '';
        results.forEach(result => {
            const card = createResultCard(result);
            elements.resultsGrid.appendChild(card);
        });
    }

    function createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const confidenceClass = getConfidenceClass(result.confidence);
        const score = Math.round(result.score);
        
        card.innerHTML = `
            <div class="confidence-badge ${confidenceClass}">
                <i class="fas fa-check-circle"></i>
                ${result.confidence} Confidence
            </div>
            <div class="result-content">
                <div class="result-score">
                    <i class="fas fa-chart-line"></i>
                    <span>Match Score: ${score}%</span>
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
        showModal();
        
        try {
            elements.modalContent.innerHTML = `
                <div class="spinner">
                    <div class="spinner-ring"></div>
                    <p>Analyzing video...</p>
                </div>
            `;
            
            elements.downloadBtn.disabled = true;
    
            console.log('Analyzing video:', videoId); 
    
            const response = await fetch(`/analyze/${videoId}`);
            const data = await response.json();
    
            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }
    
            console.log('Analysis response:', data); 
    
            state.currentAnalysis = data.analysis;
            state.currentVideoUrl = data.video_url;
            
            // Construct modal content
            let modalHTML = `<div class="analysis-content">`;
    
            // Add video section if URL is available
            if (data.video_url) {
                console.log('Adding video player with URL:', data.video_url); // Debug log
                modalHTML += `
                    <div class="video-section mb-6">
                        <div class="video-container relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                            <video 
                                id="analysis-video"
                                class="w-full h-full"
                                controls
                                preload="metadata"
                            >
                                <source src="${data.video_url}" type="application/x-mpegURL">
                                Your browser does not support HLS video playback.
                            </video>
                        </div>
                    </div>
                `;
            } else {
                console.log('No video URL available'); 
                modalHTML += `
                    <div class="video-section mb-6">
                        <div class="flex items-center justify-center w-full aspect-video rounded-lg bg-gray-100">
                            <div class="text-center p-4">
                                <i class="fas fa-video-slash text-gray-400 text-4xl mb-2"></i>
                                <p class="text-gray-600">Video preview not available</p>
                            </div>
                        </div>
                    </div>
                `;
            }
    
            // Add analysis section
            modalHTML += `
                <div class="analysis-section">
                    <h3><i class="fas fa-list-ul"></i> Key Findings</h3>
                    ${formatAnalysis(state.currentAnalysis)}
                </div>
            </div>`;
    
            elements.modalContent.innerHTML = modalHTML;
    
            // Setup video player if available
            const video = document.getElementById('analysis-video');
            if (video) {
                // Check if HLS.js is needed and available
                if (Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(data.video_url);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.ERROR, function(event, data) {
                        console.error('HLS error:', data);
                        handleVideoError();
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    // For Safari, which has native HLS support
                    video.src = data.video_url;
                } else {
                    console.error('HLS is not supported in this browser');
                    handleVideoError();
                }
    
                video.addEventListener('error', handleVideoError);
            }
    
            elements.downloadBtn.disabled = false;
    
        } catch (error) {
            console.error('Analysis error:', error);
            elements.modalContent.innerHTML = `
                <div class="error-message p-4 bg-red-50 rounded-lg">
                    <i class="fas fa-exclamation-circle text-red-500 mr-2"></i>
                    <p class="text-red-700">Failed to analyze video: ${error.message}</p>
                </div>
            `;
            elements.downloadBtn.disabled = true;
        }
    };

    // Download Handler
    async function handleDownload(e) {
        e.preventDefault();
        
        if (!state.currentAnalysis || state.isGeneratingReport) return;

        const buttonContent = this.querySelector('.button-content');
        const buttonLoader = this.querySelector('.button-loader');

        try {
            state.isGeneratingReport = true;
            this.disabled = true;
            toggleButtonLoader(true, buttonContent, buttonLoader);

            const response = await fetch('/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysis: state.currentAnalysis })
            });

            if (!response.ok) throw new Error('Failed to generate report');

            const data = await response.json();
            
            if (data.success && data.report_url) {
                window.location.href = data.report_url;
            } else {
                throw new Error('Report generation failed');
            }

        } catch (error) {
            console.error('Report generation error:', error);
            alert('Failed to generate report. Please try again.');
        } finally {
            state.isGeneratingReport = false;
            this.disabled = false;
            toggleButtonLoader(false, buttonContent, buttonLoader);
        }
    }

    // Utility Functions
    function setLoading(loading) {
        state.isLoading = loading;
        if (elements.searchButton) {
            elements.searchButton.disabled = loading;
            const buttonContent = elements.searchButton.querySelector('.button-content');
            const buttonLoader = elements.searchButton.querySelector('.button-loader');
            toggleButtonLoader(loading, buttonContent, buttonLoader);
        }
    }

    function toggleButtonLoader(show, content, loader) {
        content.style.display = show ? 'none' : 'flex';
        loader.style.display = show ? 'flex' : 'none';
    }

    function showModal() {
        elements.modal?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        elements.modal?.classList.add('hidden');
        document.body.style.overflow = '';
        state.currentAnalysis = null;
        if (elements.downloadBtn) {
            elements.downloadBtn.disabled = true;
        }
    }

    function clearResults() {
        if (elements.resultsGrid) {
            elements.resultsGrid.innerHTML = '';
        }
    }

    function showNoResults() {
        elements.resultsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No Results Found</h3>
                <p>Try different search terms</p>
            </div>
        `;
    }

    function showError(message) {
        hideElement(elements.loadingSpinner);
        hideElement(elements.resultsSection);
        showElement(elements.errorState);
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
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

    function formatAnalysis(text) {
        if (!text) return '<p class="text-gray-500">No analysis available.</p>';
        
        try {
            return text.split('\n\n')
                .map(paragraph => paragraph.trim())
                .filter(paragraph => paragraph)
                .map(paragraph => `<p class="mb-4 last:mb-0">${paragraph}</p>`)
                .join('');
        } catch (e) {
            console.error('Error formatting analysis:', e);
            return `<p class="text-gray-500">Error formatting analysis text.</p>`;
        }
    }

    function handleVideoError() {
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.innerHTML = `
                <div class="flex items-center justify-center w-full h-full bg-gray-100 rounded-lg">
                    <div class="text-center p-4">
                        <i class="fas fa-exclamation-circle text-red-500 text-2xl mb-2"></i>
                        <p class="text-gray-600">Failed to load video</p>
                    </div>
                </div>
            `;
        }
    }
});