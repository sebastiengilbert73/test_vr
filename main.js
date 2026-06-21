// main.js - Logique du tableau de bord desktop et du relais vocal

document.addEventListener('DOMContentLoaded', () => {
  // Récupérer les adresses IP injectées par la configuration de Vite
  const localIps = typeof __LOCAL_IPS__ !== 'undefined' ? __LOCAL_IPS__ : ['localhost'];
  
  // Filtrer pour obtenir une IP locale privilégiée (généralement 192.168.x.x ou 10.x.x.x)
  const preferredIp = localIps.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || localIps[0];
  const port = 5173;
  const targetUrl = `https://${preferredIp}:${port}`;

  // Mettre à jour l'affichage de l'IP principale
  const ipValueEl = document.getElementById('primary-ip-value');
  if (ipValueEl) {
    ipValueEl.textContent = targetUrl;
  }

  // Mettre à jour l'affichage des adresses secondaires s'il y en a plusieurs
  const ipListContainer = document.getElementById('secondary-ips-list');
  if (ipListContainer && localIps.length > 1) {
    localIps.forEach(ip => {
      if (ip !== preferredIp) {
        const ipCard = document.createElement('div');
        ipCard.className = 'ip-card';
        ipCard.innerHTML = `
          <span class="ip-label">Alternative</span>
          <span class="ip-value">https://${ip}:${port}</span>
          <button class="copy-btn" data-url="https://${ip}:${port}" title="Copier le lien">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
            </svg>
          </button>
        `;
        ipListContainer.appendChild(ipCard);
      }
    });
  }

  // Gérer la copie dans le presse-papier
  const toast = document.getElementById('toast');
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Lien copié dans le presse-papier !");
    } catch (err) {
      console.error('Erreur lors de la copie :', err);
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast("Lien copié !");
      } catch (err2) {
        showToast("Impossible de copier automatiquement.");
      }
      document.body.removeChild(textArea);
    }
  };

  // Event listener pour les boutons de copie
  document.body.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      const url = copyBtn.getAttribute('data-url') || targetUrl;
      copyToClipboard(url);
    }
  });

  // Génération du QR Code
  const qrPlaceholder = document.getElementById('qrcode');
  if (qrPlaceholder) {
    const checkQRCodeLib = setInterval(() => {
      if (typeof QRCode !== 'undefined') {
        clearInterval(checkQRCodeLib);
        qrPlaceholder.innerHTML = '';
        new QRCode(qrPlaceholder, {
          text: targetUrl,
          width: 128,
          height: 128,
          colorDark: "#080f0a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }, 100);
  }

  // Écouter les mises à jour de position et de distance depuis la scène A-Frame
  window.addEventListener('update-hud', (e) => {
    const { distance, onPath, progress } = e.detail;
    
    const distValEl = document.getElementById('hud-dist-value');
    if (distValEl) {
      distValEl.textContent = `${distance.toFixed(1)}m`;
    }
    
    const statusValEl = document.getElementById('hud-status-value');
    if (statusValEl) {
      if (onPath) {
        statusValEl.textContent = "Sur le sentier";
        statusValEl.style.color = "#10b981";
      } else {
        statusValEl.textContent = "Hors-sentier (Bloqué)";
        statusValEl.style.color = "#ef4444";
      }
    }
    
    const progressValEl = document.getElementById('hud-progress-value');
    if (progressValEl) {
      progressValEl.textContent = `${Math.round(progress)}%`;
    }
  });

  // --- RECONNAISSANCE VOCALE (WEB SPEECH API - CÔTÉ PC) ---
  const voiceBtn = document.getElementById('voice-trigger-btn');
  const voiceStatusText = document.getElementById('voice-status-text');
  const voiceCommandDisplay = document.getElementById('voice-command-content');
  
  let recognition = null;
  let isListening = false;
  let lanternsActive = true;
  
  if (voiceBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = false;
      
      recognition.onstart = () => {
        isListening = true;
        voiceBtn.className = 'voice-btn listening';
        voiceStatusText.textContent = "Écoute active (Parlez)...";
        voiceStatusText.classList.add('listening');
      };
      
      recognition.onend = () => {
        isListening = false;
        voiceBtn.className = 'voice-btn';
        voiceStatusText.textContent = "Micro désactivé";
        voiceStatusText.classList.remove('listening');
      };
      
      recognition.onerror = (e) => {
        console.error("Erreur de reconnaissance vocale :", e.error);
        if (e.error === 'not-allowed') {
          voiceStatusText.textContent = "Micro bloqué. Autorisez-le !";
        } else {
          voiceStatusText.textContent = `Erreur micro: ${e.error}`;
        }
        isListening = false;
        voiceBtn.className = 'voice-btn error';
        voiceStatusText.className = "voice-status-text error";
        setTimeout(() => {
          if (!isListening) {
            voiceBtn.className = 'voice-btn';
            voiceStatusText.textContent = "Micro désactivé";
            voiceStatusText.className = "voice-status-text";
          }
        }, 3000);
      };
      
      recognition.onresult = (event) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript.trim().toLowerCase();
        console.log("Commande détectée :", transcript);
        
        displayRecognizedCommand(transcript);
        sendVoiceCommandToServer(transcript);
      };
      
      voiceBtn.addEventListener('click', () => {
        if (isListening) {
          recognition.stop();
        } else {
          recognition.start();
        }
      });
    } else {
      voiceStatusText.textContent = "Reconnaissance vocale non disponible sur ce navigateur.";
      voiceBtn.style.opacity = 0.5;
    }
  }

  // Boutons de contrôle manuel (de secours et raccourcis)
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.getAttribute('data-command');
      if (command) {
        displayRecognizedCommand(command + " (Clic)");
        sendVoiceCommandToServer(command);
      }
    });
  });
  
  function displayRecognizedCommand(command) {
    if (voiceCommandDisplay) {
      voiceCommandDisplay.innerHTML = `
        <span class="voice-command-label">Dernière commande détectée :</span><br>
        <span class="voice-command-value">"${command}"</span>
      `;
    }
  }

  // Envoyer la commande vocale au serveur
  async function sendVoiceCommandToServer(commandText) {
    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: commandText })
      });
    } catch (e) {
      console.error("Erreur d'envoi réseau de la commande :", e);
    }
  }

  // --- SYSTÈME DE RÉCEPTION ET EXÉCUTION DE COMMANDES ---
  let lastProcessedTimestamp = 0;
  
  // Fonction de polling pour recevoir les commandes du serveur (utilisé par le Quest 2 et le PC)
  async function pollServerCommands() {
    try {
      const response = await fetch('/api/command');
      if (response.ok) {
        const data = await response.json();
        if (data && data.timestamp > lastProcessedTimestamp) {
          lastProcessedTimestamp = data.timestamp;
          console.log("Nouvelle commande reçue par le réseau :", data.command);
          executeVoiceCommand(data.command);
        }
      }
    } catch (e) {
      // Ignorer silencieusement pour éviter de surcharger la console
    }
  }
  
  // Démarrer le polling réseau toutes les 500ms
  setInterval(pollServerCommands, 500);

  // Interpréter et exécuter la commande vocale
  function executeVoiceCommand(command) {
    const envEl = document.querySelector('[environment]');
    const moonEl = document.getElementById('moon-light');
    const ambientEl = document.getElementById('ambient-light');
    const campfireEl = document.getElementById('campfire');
    const trailEl = document.getElementById('trail');
    const rigEl = document.getElementById('rig');
    
    // Nettoyer la commande (suppression accents et ponctuation)
    const cleanCommand = command
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .trim();

    console.log("Interprétation de la commande :", cleanCommand);

    // 1. JOUR / SOLEIL
    if (cleanCommand.includes("jour") || cleanCommand.includes("soleil") || cleanCommand.includes("matin")) {
      if (envEl) {
        envEl.setAttribute('environment', {
          skyColor: '#7dd3fc',
          horizonColor: '#bae6fd',
          skyType: 'gradient',
          lighting: 'distant',
          lightColor: '#fef08a',
          groundColor: '#14532d',
          dressingColor: '#166534'
        });
      }
      if (moonEl) {
        moonEl.setAttribute('light', {
          type: 'directional',
          color: '#fef08a',
          intensity: 0.85
        });
        moonEl.setAttribute('position', '15 40 15');
      }
      if (ambientEl) {
        ambientEl.setAttribute('light', {
          color: '#f0fdf4',
          intensity: 0.7
        });
      }
      showToast("Mode JOUR activé ☀️");
    }
    
    // 2. NUIT / LUNE
    else if (cleanCommand.includes("nuit") || cleanCommand.includes("lune") || cleanCommand.includes("soir")) {
      if (envEl) {
        envEl.setAttribute('environment', {
          skyColor: '#0b1329',
          horizonColor: '#020617',
          skyType: 'gradient',
          lighting: 'none',
          groundColor: '#052e16',
          dressingColor: '#064e3b'
        });
      }
      if (moonEl) {
        moonEl.setAttribute('light', {
          type: 'directional',
          color: '#bae6fd',
          intensity: 0.25
        });
        moonEl.setAttribute('position', '15 35 15');
      }
      if (ambientEl) {
        ambientEl.setAttribute('light', {
          color: '#1e293b',
          intensity: 0.35
        });
      }
      showToast("Mode NUIT activé 🌙");
    }
    
    // 3. ALLUMER LE FEU
    else if (((cleanCommand.includes("allume") || cleanCommand.includes("active")) && cleanCommand.includes("feu")) || cleanCommand === "feu") {
      if (campfireEl) {
        campfireEl.emit('toggle-fire', { active: true });
      }
      showToast("Feu de camp allumé 🔥");
    }
    
    // 4. ÉTEINDRE LE FEU
    else if ((cleanCommand.includes("etein") || cleanCommand.includes("coupe") || cleanCommand.includes("stop") || cleanCommand.includes("eteind")) && cleanCommand.includes("feu")) {
      if (campfireEl) {
        campfireEl.emit('toggle-fire', { active: false });
      }
      showToast("Feu de camp éteint 💨");
    }
    
    // 5. LANTERNES
    else if (cleanCommand.includes("lanterne")) {
      lanternsActive = !lanternsActive;
      if (trailEl) {
        trailEl.emit('toggle-lanterns', { active: lanternsActive });
      }
      showToast(lanternsActive ? "Lanternes du sentier allumées 💡" : "Lanternes du sentier éteintes 🌑");
    }
    
    // 6. TÉLÉPORTATION FIN
    else if (cleanCommand.includes("fin") || cleanCommand.includes("teleport") || cleanCommand.includes("camp")) {
      if (rigEl) {
        rigEl.object3D.position.set(0, 0, -152);
        const cameraEl = document.getElementById('camera');
        if (cameraEl) {
          cameraEl.setAttribute('rotation', '0 180 0');
        }
      }
      showToast("Téléportation au feu de camp 🏕️");
    }
    
    // 7. TÉLÉPORTATION DÉBUT
    else if (cleanCommand.includes("debut") || cleanCommand.includes("depart") || cleanCommand.includes("commencement") || cleanCommand.includes("retour")) {
      if (rigEl) {
        rigEl.object3D.position.set(0, 0, 0.5);
        const cameraEl = document.getElementById('camera');
        if (cameraEl) {
          cameraEl.setAttribute('rotation', '0 0 0');
        }
      }
      showToast("Retour au point de départ 🥾");
    }
  }
});
