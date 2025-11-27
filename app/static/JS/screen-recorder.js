class ScreenRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.stream = null;
        this.audioContext = null;
        this.destination = null;
    }

    async startRecording() {
        try {
            // 1. Capturar tela (Chrome configs)
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true, 
                audio: true
            });

            // 2. Capturar microfone
            let microphoneStream = null;
            try {
                microphoneStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    },
                    video: false
                });
            } catch (e) {
                console.warn("Microfone não disponível ou negado.");
            }

            // 3. Mixagem de Áudio
            this.audioContext = new AudioContext();
            this.destination = this.audioContext.createMediaStreamDestination();

            if (screenStream.getAudioTracks().length > 0) {
                const source = this.audioContext.createMediaStreamSource(new MediaStream(screenStream.getAudioTracks()));
                source.connect(this.destination);
            }

            if (microphoneStream && microphoneStream.getAudioTracks().length > 0) {
                const source = this.audioContext.createMediaStreamSource(new MediaStream(microphoneStream.getAudioTracks()));
                source.connect(this.destination);
            }

            // 4. Stream Final
            this.stream = new MediaStream([
                ...screenStream.getVideoTracks(),
                ...this.destination.stream.getAudioTracks()
            ]);

            // 5. Configuração (Chrome VP9)
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 2500000
            });

            this.recordedChunks = [];
            this.isRecording = true;
            this.startTime = Date.now();

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };

            screenStream.getVideoTracks()[0].onended = () => {
                this.stopRecording({ userStopped: true });
            };

            this.mediaRecorder.start(1000);
            return true;

        } catch (error) {
            console.error("Erro ao iniciar gravação:", error);
            if (error.name === 'NotAllowedError') {
                alert("Você precisa permitir o compartilhamento de tela para jogar.");
            } else {
                alert("Erro ao iniciar gravação. Verifique se está usando Chrome no Desktop.");
            }
            return false;
        }
    }

    /**
     * Para a gravação e faz upload
     */
    async stopRecording(metadata = {}) {
        if (!this.isRecording || !this.mediaRecorder) return null;

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = async () => {
                if (metadata.userStopped) {
                    console.log("Gravação interrompida pelo usuário.");
                    this.cleanup();
                    resolve(null);
                    return;
                }

                try {
                    const duration = Math.round((Date.now() - this.startTime) / 1000);
                    const videoBlob = new Blob(this.recordedChunks, { type: 'video/webm' });

                    const finalMeta = {
                        filename: `game_${Date.now()}.webm`,
                        file_size: videoBlob.size,
                        duration: duration,
                        game_type: 'checkers_match',
                        ...metadata
                    };

                    console.log("Iniciando upload...", finalMeta);
                    const uploadResult = await this.uploadRecording(videoBlob, finalMeta);
                    console.log("Upload concluído:", uploadResult);
                    
                    this.cleanup();
                    resolve(uploadResult);

                } catch (error) {
                    console.error("Erro no upload:", error);
                    this.cleanup();
                    resolve(null);
                }
            };

            this.mediaRecorder.stop();
            this.isRecording = false;
        });
    }

    async uploadRecording(videoBlob, metadata) {
        // 1. Pede a URL assinada (AGORA COM AUTH)
        const req = await fetch('/api/upload/request-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // <--- CRÍTICO: Envia o cookie de sessão
            body: JSON.stringify(metadata)
        });

        if (!req.ok) {
            const errText = await req.text();
            throw new Error(`Erro na API de Upload (${req.status}): ${errText}`);
        }
        
        const data = await req.json();

        if (!data.upload_url) throw new Error('URL de upload não recebida');

        // 2. Envia o arquivo para o R2
        const uploadResponse = await fetch(data.upload_url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/webm',
            },
            body: videoBlob
        });

        if (!uploadResponse.ok) throw new Error('Falha ao enviar o arquivo de vídeo para o storage');

        return data;
    }

    cleanup() {
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.mediaRecorder = null;
        if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
    }

    getStatus() { return this.isRecording; }
}

const screenRecorder = new ScreenRecorder();

window.startScreenRecording = async () => await screenRecorder.startRecording();
window.stopScreenRecording = async (meta) => await screenRecorder.stopRecording(meta);
window.isRecording = () => screenRecorder.getStatus();