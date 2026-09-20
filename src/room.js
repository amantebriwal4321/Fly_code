/**
 * The 3D Room inside 2586Labs - Henry Heffernan inspired aesthetic.
 *
 * Renders the physical workstation around Nona's training computer:
 * retro beige PC tower, CRT monitor with soft backlight, wooden desk,
 * mechanical keyboard, mouse, mug, plant, warm desk lamp, and a window
 * looking out at the Bangalore skyline.
 */

import * as THREE from 'three';

export class Room {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1018);
    this.scene.fog = new THREE.Fog(0x0e1018, 55, 175);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 450);

    // Camera viewpoints: seated at desk vs zoomed right into monitor
    this.seatPos = new THREE.Vector3(0, 9.8, 32);
    this.monitorPos = new THREE.Vector3(0, 12.5, 23);
    this.lookTarget = new THREE.Vector3(0, 12, 4);

    this.targetCamPos = this.seatPos.clone();
    this.camera.position.copy(this.seatPos);
    this.camera.lookAt(this.lookTarget);

    this._lights();
    this._room();
    this._desk();
    this._props();

    this._t = 0;
    this._intro = 0;
    this.focusMode = 'monitor'; // 'monitor' or 'room'
  }

  _lights() {
    this.scene.add(new THREE.AmbientLight(0x423854, 0.65));

    // Warm vintage desk lamp
    this.lampLight = new THREE.PointLight(0xffb86b, 2.2, 95, 1.7);
    this.lampLight.position.set(18, 26, 18);
    this.scene.add(this.lampLight);

    // Cool blue-cyan CRT monitor glow
    this.monitorLight = new THREE.PointLight(0x7fe3ff, 1.6, 75, 2.0);
    this.monitorLight.position.set(0, 13, 8);
    this.scene.add(this.monitorLight);

    // Window light from Bangalore city outside
    this.winLight = new THREE.DirectionalLight(0x9fcbf8, 0.65);
    this.winLight.position.set(-25, 35, -35);
    this.scene.add(this.winLight);
  }

  _room() {
    const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

    // Parquet hardwood floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mat(0x281d18, 0.7));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -6;
    this.scene.add(floor);

    // Studio walls
    const back = new THREE.Mesh(new THREE.PlaneGeometry(180, 100), mat(0x2a2536));
    back.position.set(0, 32, -36);
    this.scene.add(back);

    const left = new THREE.Mesh(new THREE.PlaneGeometry(160, 100), mat(0x221e2c));
    left.rotation.y = Math.PI / 2;
    left.position.set(-54, 32, 0);
    this.scene.add(left);

    // Window overlooking Bangalore
    const winGeo = new THREE.PlaneGeometry(36, 28);
    const winMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        varying vec2 vUv;
        void main(){
          vec3 sky = vec3(0.42, 0.72, 0.95);
          vec3 bld = vec3(0.18, 0.15, 0.28);
          vec3 c = mix(bld, sky, pow(vUv.y, 0.75));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(-32, 36, -35.5);
    this.scene.add(win);

    const frame = new THREE.Mesh(new THREE.PlaneGeometry(40, 32), mat(0x161320));
    frame.position.set(-32, 36, -35.7);
    this.scene.add(frame);

    // Framed Poster on the back wall: "MaleCNS v1.0 Fruit Fly Connectome"
    const posterFrame = new THREE.Mesh(new THREE.BoxGeometry(22, 28, 0.6), mat(0x121016));
    posterFrame.position.set(22, 34, -35.2);
    const posterCanvas = document.createElement('canvas');
    posterCanvas.width = 256; posterCanvas.height = 320;
    const pg = posterCanvas.getContext('2d');
    pg.fillStyle = '#0b0f19'; pg.fillRect(0, 0, 256, 320);
    pg.fillStyle = '#6be6ff'; pg.font = 'bold 22px monospace'; pg.fillText('MaleCNS v1.0', 20, 48);
    pg.fillStyle = '#ffc46b'; pg.font = '14px monospace'; pg.fillText('CENTRAL COMPLEX', 20, 80);
    pg.fillStyle = '#8891a5'; pg.font = '11px monospace'; pg.fillText('166 Neurons · Ring Attractor', 20, 105);
    pg.fillText('Janelia / Google Research', 20, 125);
    pg.strokeStyle = '#6be6ff'; pg.lineWidth = 2; pg.beginPath(); pg.arc(128, 220, 60, 0, Math.PI * 2); pg.stroke();
    const pTex = new THREE.CanvasTexture(posterCanvas);
    const posterInner = new THREE.Mesh(new THREE.PlaneGeometry(20, 26), new THREE.MeshBasicMaterial({ map: pTex }));
    posterInner.position.set(22, 34, -34.8);
    this.scene.add(posterFrame, posterInner);
  }

  _desk() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x483424, roughness: 0.65 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.5 });
    const beigePC = new THREE.MeshStandardMaterial({ color: 0xd6cebd, roughness: 0.55 }); // Classic retro 90s beige!

    // Solid wood tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(68, 2.2, 28), wood);
    top.position.set(0, 3, 14);
    this.scene.add(top);

    // Sturdy desk legs
    for (const x of [-30, 30]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.5, 9, 24), wood);
      leg.position.set(x, -1.5, 14);
      this.scene.add(leg);
    }

    // CRT Monitor Bezel (Retro curved casing)
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(31, 20.5, 4.5), beigePC);
    bezel.position.set(0, 13.5, 5);
    this.scene.add(bezel);

    // CRT Glass Screen
    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(27.5, 17),
      new THREE.MeshBasicMaterial({ color: 0x07111e })
    );
    this.screen.position.set(0, 13.5, 7.3);
    this.scene.add(this.screen);

    // Monitor Stand
    const neck = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), darkMetal);
    neck.position.set(0, 5.8, 5);
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 0.8, 24), darkMetal);
    basePlate.position.set(0, 4.4, 6);
    this.scene.add(neck, basePlate);

    // Retro 90s Desktop PC Tower sitting on the desk
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 18), beigePC);
    tower.position.set(26, 11, 10);
    this.scene.add(tower);

    // Floppy Disk drive slots + CD-ROM bay on PC tower
    const driveBay = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 6), darkMetal);
    driveBay.position.set(21.9, 14, 12);
    const powerLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x38e878 })
    );
    powerLed.position.set(21.9, 7.5, 16);
    this.scene.add(driveBay, powerLed);

    // Mechanical Keyboard
    const kb = new THREE.Mesh(new THREE.BoxGeometry(21, 1.2, 7), beigePC);
    kb.position.set(0, 4.6, 18);
    kb.rotation.x = -0.06;
    this.scene.add(kb);

    // Mouse & Mouse Pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x1a2e40 }));
    pad.position.set(16, 4.2, 18);
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 4.5), beigePC);
    mouse.position.set(16, 4.8, 18);
    this.scene.add(pad, mouse);

    // Bio-Agent Charging Dock & Perch on Desk (To the left of the keyboard)
    const dockBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 4.0, 0.7, 24),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.8 })
    );
    dockBase.position.set(-13, 4.3, 16);

    const dockRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, 0.14, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    dockRing.rotation.x = Math.PI / 2;
    dockRing.position.set(-13, 4.65, 16);
    this.scene.add(dockBase, dockRing);

    // Build the Perched 3D Fly on the Dock!
    this.perchedFly = new THREE.Group();
    this.perchedFly.position.set(-13, 5.3, 16);
    this.perchedFly.rotation.y = 0.55; // Angled toward CRT monitor and keyboard

    const flyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1528,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.2,
    });
    const flyEyeMat = new THREE.MeshStandardMaterial({
      color: 0xd90429,
      emissive: 0xff1744,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });

    // Thorax
    this.flyThorax = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 14), flyMat);
    this.flyThorax.scale.set(0.9, 0.85, 1.1);
    this.perchedFly.add(this.flyThorax);

    // Abdomen with stripes
    this.flyAbdomen = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 14), flyMat);
    this.flyAbdomen.position.set(0, -0.2, 1.9);
    this.flyAbdomen.scale.set(0.85, 0.75, 1.4);
    this.perchedFly.add(this.flyAbdomen);

    // Head
    this.flyHead = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), flyMat);
    this.flyHead.position.set(0, 0.1, -1.2);
    this.perchedFly.add(this.flyHead);

    // Compound ruby eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), flyEyeMat);
    eyeL.position.set(0.42, 0.15, -1.4);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), flyEyeMat);
    eyeR.position.set(-0.42, 0.15, -1.4);
    this.flyHead.add(eyeL, eyeR);

    // Antennae
    const antMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    for (const dir of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), antMat);
      ant.position.set(dir * 0.25, 0.65, -1.5);
      ant.rotation.x = -0.6;
      ant.rotation.z = dir * 0.4;
      this.flyHead.add(ant);
    }

    // Translucent wings
    const flyWingMat = new THREE.MeshBasicMaterial({
      color: 0xcfeeff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const wg = new THREE.PlaneGeometry(4.8, 1.9);
    wg.translate(2.4, 0, 0);

    this.flyWingL = new THREE.Mesh(wg, flyWingMat);
    this.flyWingR = new THREE.Mesh(wg.clone(), flyWingMat);
    this.flyWingR.scale.x = -1;
    this.flyWingL.position.set(0.35, 0.6, 0.2);
    this.flyWingR.position.set(-0.35, 0.6, 0.2);
    this.flyWingL.rotation.y = 0.2;
    this.flyWingR.rotation.y = -0.2;
    this.perchedFly.add(this.flyWingL, this.flyWingR);

    // Glowing PointLight around the Fly
    this.flyDeskGlow = new THREE.PointLight(0x38bdf8, 1.8, 24);
    this.flyDeskGlow.position.set(0, 0.8, 0);
    this.perchedFly.add(this.flyDeskGlow);

    this.scene.add(this.perchedFly);
    this.flyReactTimer = 0;
    this.flyReactType = null;
  }

  _props() {
    // Ceramic Coffee Mug
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.4, 3.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xe05638, roughness: 0.4 })
    );
    mug.position.set(-22, 5.7, 16);
    this.scene.add(mug);

    // Succulent Plant
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 1.8, 4, 16),
      new THREE.MeshStandardMaterial({ color: 0xb56942, roughness: 0.8 })
    );
    pot.position.set(-22, 6, 8);
    this.scene.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x489650, roughness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7.5, 6), leafMat);
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(-22 + Math.cos(a) * 1.5, 11 + Math.sin(i) * 1.2, 8 + Math.sin(a) * 1.5);
      leaf.rotation.z = Math.cos(a) * 0.45;
      leaf.rotation.x = Math.sin(a) * 0.45;
      this.scene.add(leaf);
    }

    // Desk Lamp
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.4 });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.8, 20), lampMat);
    lampBase.position.set(20, 4.5, 2);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 16, 8), lampMat);
    lampStem.position.set(18, 12, 4);
    lampStem.rotation.z = 0.4;
    const lampHead = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 4.5, 18, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x332a24,
        side: THREE.DoubleSide,
        emissive: 0xffb86b,
        emissiveIntensity: 0.8,
      })
    );
    lampHead.position.set(13, 20, 6);
    lampHead.rotation.z = -0.9;
    this.scene.add(lampBase, lampStem, lampHead);

    // Ergonomic Chair back
    const chair = new THREE.Mesh(
      new THREE.BoxGeometry(26, 18, 3),
      new THREE.MeshStandardMaterial({ color: 0x24222c, roughness: 0.75 })
    );
    chair.position.set(0, 5, 38);
    this.scene.add(chair);
  }

  enter() {
    this._intro = 0;
    this._wide = new THREE.Vector3(-36, 28, 52);
    this.focusMode = 'monitor';
    if (this.perchedFly) {
      this.perchedFly.position.set(-13, 5.3, 16);
      this.perchedFly.rotation.set(0, 0.55, 0);
      this.perchedFly.visible = true;
    }
  }

  setFocus(mode) {
    this.focusMode = mode === 'room' ? 'room' : 'monitor';
  }

  flyReact(type = 'learn') {
    this.flyReactType = type;
    this.flyReactTimer = type === 'takeoff' ? 1.4 : 0.85;
    if (this.flyDeskGlow) {
      if (type === 'learn') {
        this.flyDeskGlow.color.setHex(0xf59e0b); // Gold
        this.flyDeskGlow.intensity = 3.2;
      } else if (type === 'write') {
        this.flyDeskGlow.color.setHex(0x10b981); // Emerald Green
        this.flyDeskGlow.intensity = 3.0;
      } else if (type === 'reward') {
        this.flyDeskGlow.color.setHex(0xec4899); // Magenta/Pink
        this.flyDeskGlow.intensity = 3.4;
      } else if (type === 'takeoff') {
        this.flyDeskGlow.color.setHex(0x06b6d4); // Cyan
        this.flyDeskGlow.intensity = 3.5;
      }
      setTimeout(() => {
        if (this.flyDeskGlow) {
          this.flyDeskGlow.color.setHex(0x38bdf8);
          this.flyDeskGlow.intensity = 1.8;
        }
      }, 1000);
    }
  }

  /** Pull camera out from monitor towards window as fly takes off */
  exit(done) {
    this.flyReact('takeoff');
    const from = this.camera.position.clone();
    const target = new THREE.Vector3(-20, 26, 16);
    const lookTarget = new THREE.Vector3(-32, 36, -35.5); // toward Bangalore skyline outside window
    const t0 = performance.now();
    const dur = 700;

    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(from, target, e);
      this.camera.lookAt(lookTarget);
      this.renderer.render(this.scene, this.camera);
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  render(dt) {
    this._t += dt;
    if (this._intro < 1) this._intro = Math.min(1, this._intro + dt / 1.2);

    const targetPos = this.focusMode === 'room' ? this.seatPos : this.monitorPos;
    const e = 1 - Math.pow(1 - this._intro, 3);
    this.camera.position.lerpVectors(this._wide || targetPos, targetPos, e);

    // Subtle gentle breathing sway
    this.camera.position.x += Math.sin(this._t * 0.6) * 0.15;
    this.camera.position.y += Math.sin(this._t * 0.8) * 0.1;
    this.camera.lookAt(this.lookTarget);

    // Subtle monitor flicker
    this.monitorLight.intensity = 1.6 + Math.sin(this._t * 8) * 0.08;

    // Perched Bio-Agent Fly animation on the desk
    if (this.perchedFly) {
      // Natural breathing oscillation
      const breath = Math.sin(this._t * 3.5);
      if (this.flyThorax) this.flyThorax.scale.y = 0.85 + breath * 0.03;
      if (this.flyAbdomen) this.flyAbdomen.scale.y = 0.75 + breath * 0.04;

      // Head subtly tracks user or monitor
      if (this.flyHead) {
        this.flyHead.rotation.y = Math.sin(this._t * 1.4) * 0.25;
        this.flyHead.rotation.x = -0.05 + Math.cos(this._t * 1.0) * 0.08;
      }

      // Excited or resting wing action
      if (this.flyReactTimer > 0) {
        this.flyReactTimer -= dt;
        const buzzSpeed = this.flyReactType === 'takeoff' ? 140 : 80;
        this.flyWingL.rotation.z = Math.sin(this._t * buzzSpeed) * 0.6;
        this.flyWingR.rotation.z = -Math.sin(this._t * buzzSpeed) * 0.6;

        if (this.flyReactType === 'takeoff') {
          this.perchedFly.position.y += dt * 10;
          this.perchedFly.position.x += dt * 6;
          this.perchedFly.position.z -= dt * 10;
        } else {
          // Playful hop on the charging dock
          this.perchedFly.position.y = 5.3 + Math.abs(Math.sin(this._t * 14)) * 0.4;
        }
      } else {
        // Subtle resting wing twitches
        const isTwitch = Math.sin(this._t * 0.45) > 0.85;
        const twitch = isTwitch ? Math.sin(this._t * 32) * 0.12 : 0;
        this.flyWingL.rotation.z = 0.08 + twitch;
        this.flyWingR.rotation.z = -0.08 - twitch;
        this.perchedFly.position.y = 5.3;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
