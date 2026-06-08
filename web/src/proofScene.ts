import {
  AdditiveBlending,
  BufferGeometry,
  Clock,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  TorusKnotGeometry,
  Vector2,
  WebGLRenderer,
} from "three";

export class ProofScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly clock = new Clock();
  private readonly lattice: Mesh;
  private readonly shardField: Points;
  private readonly fieldGroup = new Group();
  private readonly pointer = new Vector2(0, 0);
  private destroyed = false;
  private stress = 0.4;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setClearColor(0x05070a, 0);
    this.renderer.domElement.className = "proof-canvas";
    host.appendChild(this.renderer.domElement);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 7);

    this.lattice = new Mesh(
      new TorusKnotGeometry(1.35, 0.32, 220, 24),
      new MeshBasicMaterial({
        color: new Color("#66f0cf"),
        wireframe: true,
        transparent: true,
        opacity: 0.58,
      }),
    );
    this.fieldGroup.add(this.lattice);
    this.shardField = this.createShardField();
    this.fieldGroup.add(this.shardField);
    this.scene.add(this.fieldGroup);

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("pointermove", this.onPointerMove);
    this.tick();
  }

  setStress(level: number): void {
    this.stress = Math.max(0.1, Math.min(level, 1.2));
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.dispose();
  }

  private createShardField(): Points {
    const geometry = new BufferGeometry();
    const points: number[] = [];
    for (let index = 0; index < 1800; index += 1) {
      const radius = 1.8 + Math.random() * 2.8;
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * 3.8;
      points.push(Math.cos(angle) * radius, elevation, Math.sin(angle) * radius);
    }

    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    return new Points(
      geometry,
      new PointsMaterial({
        color: new Color("#e7fff7"),
        size: 0.018,
        transparent: true,
        opacity: 0.86,
        blending: AdditiveBlending,
      }),
    );
  }

  private readonly resize = (): void => {
    const { clientWidth, clientHeight } = this.host;
    this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  private tick = (): void => {
    if (this.destroyed) {
      return;
    }

    const elapsed = this.clock.getElapsedTime();
    this.fieldGroup.rotation.x = elapsed * 0.11 + this.pointer.y * 0.16;
    this.fieldGroup.rotation.y = elapsed * (0.18 + this.stress * 0.08) + this.pointer.x * 0.24;
    this.lattice.rotation.z = elapsed * 0.2;
    this.shardField.rotation.y = -elapsed * 0.05;
    (this.shardField.material as PointsMaterial).opacity = 0.45 + this.stress * 0.35;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  };
}
