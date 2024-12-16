document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        searchInput: document.getElementById('searchInput'),
        suggestionsDropdown: document.getElementById('suggestionsDropdown'),
        clearButton: document.querySelector('.clear-search'),
        actionButton: document.getElementById('searchActionButton'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        resultsSection: document.getElementById('resultsSection'),
        resultsGrid: document.getElementById('resultsGrid'),
        errorState: document.getElementById('errorState'),
        modal: document.getElementById('analysisModal'),
        modalContent: document.getElementById('analysisContent'),
        closeButton: document.querySelector('.modal .close-button'),
        downloadButton: document.querySelector('.download-button')
    };


    const state = {
        isLoading: false,
        currentAnalysis: null,
        lastQuery: ''
    };


    function initializeEventListeners() {
        elements.searchInput?.addEventListener('input', handleSearchInput);
        elements.clearButton?.addEventListener('click', clearSearch);
        elements.actionButton?.addEventListener('click', handleSearch);
        elements.closeButton?.addEventListener('click', closeModal);
        elements.downloadButton?.addEventListener('click', handleDownload);

        elements.modal?.addEventListener('click', (e) => {
            if (e.target === elements.modal) closeModal();
        });
    }

    async function handleSearch() {
        const query = elements.searchInput.value.trim();
        if (!query || state.isLoading) return;

        state.lastQuery = query;
        setLoading(true);

        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            displayResults(results);

        } catch (error) {
            console.error('Search error:', error);
            showError('Failed to perform search. Please try again.');
        } finally {
            setLoading(false);
        }
    }


function createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const confidence = result.confidence.toLowerCase();
    const confidenceClass = confidence === 'high' ? 'confidence-high' : 'confidence-medium';
    const score = Math.round(result.score * 100);

    card.innerHTML = `
        <div class="result-video-container ${result.video_url ? 'loading' : ''}">
            ${result.video_url ? `
                <video 
                    id="video-${result.video_id}"
                    class="result-video"
                    controls
                    preload="metadata"
                >
                    <source src="${result.video_url}" type="application/x-mpegURL">
                </video>
            ` : `
                <div class="video-placeholder">
                    <i class="fas fa-video-slash"></i>
                    <p>Video preview not available</p>
                </div>
            `}
            <div class="video-overlay">
                <div class="confidence-badge ${confidenceClass}">
                    <i class="fas fa-check-circle"></i>
                    ${result.confidence}
                </div>
                <div class="score-badge">
                    <i class="fas fa-chart-line"></i>
                    ${score}%
                </div>
            </div>
        </div>
        <div class="result-content">
            <div class="result-info">
                <div class="result-time">
                    <i class="fas fa-clock"></i>
                    <span>${formatTimeRange(result.start, result.end)}</span>
                </div>
                <button class="analyze-btn" onclick="analyzeVideo('${result.video_id}')">
                    <i class="fas fa-microscope"></i>
                    <span>Detailed Analysis</span>
                </button>
            </div>
        </div>
    `;

    if (result.video_url) {
        const videoContainer = card.querySelector('.result-video-container');
        const video = card.querySelector(`#video-${result.video_id}`);
        
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(result.video_url);
            hls.attachMedia(video);
            
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = result.start;
                videoContainer.classList.remove('loading');
            });

            hls.on(Hls.Events.ERROR, () => {
                videoContainer.innerHTML = `
                    <div class="video-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load video</p>
                    </div>
                `;
            });
        }
    }

    return card;
}

    function initializeVideoPlayer(videoElement, result) {
        if (Hls.isSupported() && result.video_url) {
            const hls = new Hls();
            hls.loadSource(result.video_url);
            hls.attachMedia(videoElement);

            videoElement.addEventListener('loadedmetadata', () => {
                videoElement.currentTime = result.start;
            });
        }
    }

    window.analyzeVideo = async function(videoId) {
        const modalContent = document.getElementById('analysisContent');
        const downloadButton = document.querySelector('.download-button');
        const modal = document.getElementById('analysisModal');

        modal.classList.remove('hidden');
        modalContent.innerHTML = `
            <div class="spinner">
                <div class="spinner-ring"></div>
                <p>Analyzing video...</p>
            </div>
        `;
        downloadButton.disabled = true;
    
        try {
            console.log('Analyzing video:', videoId);
            const response = await fetch(`/analyze/${videoId}`);
            const data = await response.json();
            console.log('Analysis response:', data);
    
            if (!response.ok) {
                console.error('Response not OK:', response.status, response.statusText);
                throw new Error(data.error || 'Analysis failed');
            }
    
            console.log('Analysis data structure:', {
                hasVideoUrl: !!data.video_url,
                hasAnalysis: !!data.analysis,
                analysisLength: data.analysis ? data.analysis.length : 0,
                analysisType: data.analysis ? typeof data.analysis : 'undefined'
            });
    
            const analysisText = data.analysis;
            if (!analysisText) {
                console.error('No analysis text available');
                throw new Error('No analysis data available');
            }
    
            const modalHTML = `
                <div class="analysis-content">
                    ${data.video_url ? `
                        <div class="video-section">
                            <video 
                                id="analysis-video"
                                class="analysis-video"
                                controls
                                preload="metadata"
                            >
                                <source src="${data.video_url}" type="application/x-mpegURL">
                            </video>
                        </div>
                    ` : ''}
                    <div class="analysis-text">
                        <h3>
                            <i class="fas fa-clipboard-list"></i>
                            Analysis Details
                        </h3>
                        <div class="analysis-paragraphs">
                            ${formatAnalysisText(analysisText)}
                        </div>
                    </div>
                </div>
            `;
    
            console.log('Setting modal HTML');
            modalContent.innerHTML = modalHTML;
    
            if (data.video_url) {
                console.log('Initializing video player with URL:', data.video_url);
                const video = document.getElementById('analysis-video');
                if (video && Hls.isSupported()) {
                    try {
                        const hls = new Hls();
                        hls.loadSource(data.video_url);
                        hls.attachMedia(video);
                        
                        hls.on(Hls.Events.ERROR, function(event, data) {
                            console.error('HLS error:', event, data);
                            if (data.fatal) {
                                handleVideoError();
                            }
                        });
    
                        hls.on(Hls.Events.MANIFEST_PARSED, function() {
                            console.log('Video manifest parsed successfully');
                        });
                    } catch (videoError) {
                        console.error('Error initializing video:', videoError);
                        handleVideoError();
                    }
                }
            }
    
            window.currentAnalysis = analysisText;
            downloadButton.disabled = false;
    
        } catch (error) {
            console.error('Analysis error details:', error);
            modalContent.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${error.message || 'Failed to analyze video. Please try again.'}</p>
                    <button class="retry-btn" onclick="analyzeVideo('${videoId}')">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    };
    
    function formatAnalysisText(text) {
        console.log('Formatting analysis text:', text ? text.substring(0, 100) + '...' : 'null');
        
        if (!text) {
            return '<p class="analysis-paragraph">No analysis available.</p>';
        }
    

        const cleanText = text
            .replace(/\\n/g, '\n')  
            .replace(/^"|"$/g, '')  
            .trim();
    

        const formatted = cleanText
            .split('\n\n')
            .map(p => p.trim())
            .filter(p => p)
            .map(p => `<p class="analysis-paragraph">${p}</p>`)
            .join('');
    
        console.log('Formatted analysis:', formatted.substring(0, 100) + '...');
        return formatted;
    }
    
    function handleVideoError() {
        console.log('Handling video error');
        const videoSection = document.querySelector('.video-section');
        if (videoSection) {
            videoSection.innerHTML = `
                <div class="video-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Failed to load video</p>
                    <button class="retry-btn" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    async function handleDownload() {
        if (!window.currentAnalysis) return;
    
        const downloadButton = document.querySelector('.download-button');
        const originalText = downloadButton.innerHTML;
        
        try {
            downloadButton.disabled = true;
            downloadButton.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Generating report...
            `;
    
            const response = await fetch('/generate-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysis: window.currentAnalysis
                })
            });
    
            const data = await response.json();
    
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate report');
            }
    
            if (data.report_url) {
                window.location.href = data.report_url;
            }
    
        } catch (error) {
            console.error('Download error:', error);
            alert(error.message || 'Failed to download report. Please try again.');
        } finally {
            downloadButton.disabled = false;
            downloadButton.innerHTML = originalText;
        }
    }
    function clearSearch() {
        elements.searchInput.value = '';
        elements.suggestionsDropdown?.classList.remove('show');
        elements.actionButton.disabled = true;
    }

    function handleSearchInput(e) {
        const value = e.target.value.trim();
        elements.actionButton.disabled = !value;
    }

    function setLoading(loading) {
        state.isLoading = loading;
        elements.actionButton.disabled = loading;
        elements.actionButton.classList.toggle('loading', loading);
        
        if (loading) {
            showElement(elements.loadingSpinner);
            hideElement(elements.resultsSection);
            hideElement(elements.errorState);
        } else {
            hideElement(elements.loadingSpinner);
        }
    }

    function showModal() {
        elements.modal?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        elements.modal?.classList.add('hidden');
        document.body.style.overflow = '';
        state.currentAnalysis = null;
        if (elements.downloadButton) {
            elements.downloadButton.disabled = true;
        }
    }

    function formatTimeRange(start, end) {
        return `${formatTime(start)} - ${formatTime(end)}`;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function formatAnalysisText(text) {
        if (!text) return '<p>No analysis available.</p>';
        
        return text.split('\n\n')
            .map(p => p.trim())
            .filter(p => p)
            .map(p => `<p class="analysis-paragraph">${p}</p>`)
            .join('');
    }

    function showElement(element) {
        element?.classList.remove('hidden');
    }

    function hideElement(element) {
        element?.classList.add('hidden');
    }

    initializeEventListeners();
});