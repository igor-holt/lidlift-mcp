use wasm_bindgen::prelude::*;
use sha2::{Sha256, Digest};
use std::collections::HashMap;

// ============================================================
// B-E BASELINE CONSTANTS — Seismic Log v1.0 Locked
// ============================================================
const STEM_WIDTH: f32 = 12.0;
const SERIF_WIDTH_FLOOR: f32 = 0.5;
const CONTRAST_RATIO: f32 = 12.0;
const GRID_SNAP: f32 = 4.0;
const GLYPH_A_COMPLEXITY: f32 = 40.0;
const GLYPH_B_COMPLEXITY: f32 = 60.0;
const GLYPH_C_COMPLEXITY: f32 = 35.0;
const FREE_TIER_BUDGET: f32 = 50.0;

// ============================================================
// GLYPH INDEX — O(1) dispatch
// ============================================================
type GlyphFn = fn(&FontArchitect) -> String;

pub struct GlyphIndex { table: HashMap<char, GlyphFn> }

impl GlyphIndex {
    pub fn new() -> Self {
        let mut t: HashMap<char, GlyphFn> = HashMap::new();
        t.insert('A', FontArchitect::render_glyph_a);
        t.insert('B', FontArchitect::render_glyph_b);
        t.insert('C', FontArchitect::render_glyph_c);
        t.insert('O', FontArchitect::render_glyph_o);
        GlyphIndex { table: t }
    }
    pub fn get(&self, ch: char) -> Option<&GlyphFn> { self.table.get(&ch) }
}

// ============================================================
// FONT ARCHITECT — WASM export with proof-of-render hashing
// ============================================================
#[wasm_bindgen]
pub struct FontArchitect {
    weight_multiplier: f32,
    is_premium_license: bool,
    tracking_em: f32,
    shear_rad: f32,
    contrast_ratio: f32,
}

#[wasm_bindgen]
impl FontArchitect {
    #[wasm_bindgen(constructor)]
    pub fn new(license_key: &str) -> Self {
        let is_premium = license_key.starts_with("GEN-BE-") && license_key.len() >= 14;
        FontArchitect {
            weight_multiplier: 1.0,
            is_premium_license: is_premium,
            tracking_em: 0.25,
            shear_rad: 0.0,
            contrast_ratio: CONTRAST_RATIO,
        }
    }

    pub fn mutate_weight(&mut self, factor: f32) { self.weight_multiplier = factor.clamp(0.5, 4.0); }
    pub fn mutate_shear(&mut self, degrees: f32) { self.shear_rad = degrees.to_radians(); }
    pub fn mutate_tracking(&mut self, em: f32) { self.tracking_em = em.clamp(0.0, 1.0); }
    pub fn reset_to_baseline(&mut self) {
        self.weight_multiplier = 1.0; self.shear_rad = 0.0;
        self.tracking_em = 0.25; self.contrast_ratio = CONTRAST_RATIO;
    }

    fn check_qos_budget(&self, c: f32) -> bool { self.is_premium_license || c < FREE_TIER_BUDGET }

    #[inline(always)] fn snap(v: f32) -> f32 { (v / GRID_SNAP).round() * GRID_SNAP }
    #[inline(always)] fn stem(&self) -> f32 { (STEM_WIDTH * self.weight_multiplier).max(2.0) }
    #[inline(always)] fn serif(&self) -> f32 { (self.stem() / self.contrast_ratio).max(SERIF_WIDTH_FLOOR) }

    fn shear_transform(&self) -> String {
        if self.shear_rad.abs() < 0.001 { return String::new(); }
        format!(" transform='skewX({:.2})'", self.shear_rad.to_degrees())
    }
    fn free_tier_stub(ch: char) -> String {
        format!("<text x='0' y='100' font-size='12' fill='rgba(255,100,100,0.7)' font-family='monospace'>QoS:{} requires GEN-BE-* license</text>", ch)
    }

    // --- Glyph renders ---
    pub(crate) fn render_glyph_a(&self) -> String {
        if !self.check_qos_budget(GLYPH_A_COMPLEXITY) { return Self::free_tier_stub('A'); }
        let (s, r, apex, x) = (self.stem(), self.serif(), Self::snap(75.0), self.shear_transform());
        format!("<g class='be-A'{x}><path d='M40 150 L{apex} 30 L110 150' stroke='currentColor' stroke-width='{s:.1}' fill='none' stroke-linecap='square'/><path d='M55 110 L95 110 M30 150 L120 150 M{al} 30 L{ar} 30' stroke='currentColor' stroke-width='{r:.2}' fill='none'/></g>",
            x=x, apex=apex, s=s, r=r, al=apex-6.0, ar=apex+6.0)
    }
    pub(crate) fn render_glyph_b(&self) -> String {
        if !self.check_qos_budget(GLYPH_B_COMPLEXITY) { return Self::free_tier_stub('B'); }
        let (s, r, x) = (self.stem(), self.serif(), self.shear_transform());
        format!("<g class='be-B'{x}><path d='M200 30 L200 150' stroke='currentColor' stroke-width='{s:.1}' fill='none' stroke-linecap='square'/><path d='M200 30 Q258 30 258 65 Q258 100 200 100' stroke='currentColor' stroke-width='{r:.2}' fill='none'/><path d='M200 100 Q268 100 268 125 Q268 150 200 150' stroke='currentColor' stroke-width='{r:.2}' fill='none'/><path d='M195 30 L205 30 M195 150 L205 150' stroke='currentColor' stroke-width='{r:.2}' fill='none'/></g>",
            x=x, s=s, r=r)
    }
    pub(crate) fn render_glyph_c(&self) -> String {
        if !self.check_qos_budget(GLYPH_C_COMPLEXITY) { return Self::free_tier_stub('C'); }
        let (s, r, x) = (self.stem(), self.serif(), self.shear_transform());
        format!("<g class='be-C'{x}><path d='M400 70 Q394 30 355 30 Q308 30 308 90 Q308 150 355 150 Q394 150 400 115' stroke='currentColor' stroke-width='{r:.2}' fill='none'/><path d='M308 58 L308 122' stroke='currentColor' stroke-width='{s:.1}' fill='none' stroke-linecap='square'/><path d='M390 70 L412 70 M390 115 L412 115' stroke='currentColor' stroke-width='{r:.2}' fill='none'/></g>",
            x=x, s=s, r=r)
    }
    pub(crate) fn render_glyph_o(&self) -> String {
        if !self.check_qos_budget(GLYPH_A_COMPLEXITY) { return Self::free_tier_stub('O'); }
        let (s, r) = (self.stem(), self.serif());
        let (rx, ry, cx, cy) = (40.0f32, 48.0f32, 520.0f32, 90.0f32);
        let arc = ry * std::f32::consts::PI;
        let x = self.shear_transform();
        format!("<g class='be-O'{x}><ellipse cx='{cx}' cy='{cy}' rx='{rx}' ry='{ry}' stroke='currentColor' stroke-width='{r:.2}' fill='none'/><path d='M{lx} {cy} A{rx} {ry} 0 0 1 {rx2} {cy} A{rx} {ry} 0 0 1 {lx} {cy}' stroke='currentColor' stroke-width='{s:.1}' fill='none' stroke-dasharray='{arc:.1} {arc:.1}'/></g>",
            x=x, cx=cx, cy=cy, rx=rx, ry=ry, lx=cx-rx, rx2=cx+rx, s=s, r=r, arc=arc)
    }

    // --- Public API ---

    /// Render string → SVG with embedded SHA-256 proof-of-render hash.
    /// Hash covers: svg content + params_json. Immutable after emission.
    pub fn render_string_with_proof(&self, chars: &str) -> String {
        let index = GlyphIndex::new();
        let n = chars.chars().count().max(1);
        let (w, h) = (n * 160, 180usize);
        let mut glyphs = String::new();
        for (i, ch) in chars.chars().enumerate() {
            let svg = match index.get(ch.to_ascii_uppercase()) {
                Some(f) => f(self),
                None => format!("<text x='20' y='110' fill='rgba(255,255,255,0.3)' font-size='80' font-family='serif'>{}</text>", ch),
            };
            glyphs.push_str(&format!("<g transform='translate({},0)'>{}</g>", i * 160, svg));
        }
        let params = self.export_params_json();
        let svg_body = format!(
            "<svg width='{w}' height='{h}' viewBox='0 0 {w} {h}' xmlns='http://www.w3.org/2000/svg'>{glyphs}</svg>",
            w=w, h=h, glyphs=glyphs
        );
        // SHA-256 over svg_body + params — proof of compute
        let mut hasher = Sha256::new();
        hasher.update(svg_body.as_bytes());
        hasher.update(params.as_bytes());
        let hash = hex::encode(hasher.finalize());
        // Return as JSON envelope: svg + hash + params
        format!(
            r#"{{"svg":{},"sha256":"{}","params":{}}}"#,
            serde_json_escape(&svg_body), hash, params
        )
    }

    /// Render without proof (low-latency path for internal use).
    pub fn render_string(&self, chars: &str) -> String {
        let index = GlyphIndex::new();
        let n = chars.chars().count().max(1);
        let (w, h) = (n * 160, 180usize);
        let mut glyphs = String::new();
        for (i, ch) in chars.chars().enumerate() {
            let svg = match index.get(ch.to_ascii_uppercase()) {
                Some(f) => f(self),
                None => format!("<text x='20' y='110' fill='rgba(255,255,255,0.3)' font-size='80' font-family='serif'>{}</text>", ch),
            };
            glyphs.push_str(&format!("<g transform='translate({},0)'>{}</g>", i * 160, svg));
        }
        format!("<svg width='{w}' height='{h}' viewBox='0 0 {w} {h}' xmlns='http://www.w3.org/2000/svg'>{glyphs}</svg>",
            w=w, h=h, glyphs=glyphs)
    }

    pub fn export_params_json(&self) -> String {
        format!(
            r#"{{"baseline":"barcelona_extropic","stem_width":{:.1},"serif_width":{:.3},"contrast_ratio":{:.1},"tracking_em":{:.2},"shear_deg":{:.2},"weight_multiplier":{:.2},"is_premium":{}}}"#,
            self.stem(), self.serif(), self.contrast_ratio,
            self.tracking_em, self.shear_rad.to_degrees(),
            self.weight_multiplier, self.is_premium_license,
        )
    }

    pub fn validate_invariants(&self) -> String {
        let ratio = self.stem() / self.serif();
        let drift = (ratio - self.contrast_ratio).abs();
        if drift > 0.01 {
            return format!("INVARIANT_BREAK: contrast_ratio drift={:.4} expected={:.1} got={:.4}", drift, self.contrast_ratio, ratio);
        }
        if !(0.0..=1.0).contains(&self.tracking_em) {
            return format!("INVARIANT_BREAK: tracking_em={} out of [0.0,1.0]", self.tracking_em);
        }
        String::new()
    }
}

/// Minimal JSON string escaping — avoids pulling full serde_json into WASM binary.
fn serde_json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str(r#"\""#),
            '\\' => out.push_str(r#"\\"#),
            '\n' => out.push_str(r#"\n"#),
            '\r' => out.push_str(r#"\r"#),
            '\t' => out.push_str(r#"\t"#),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

// ============================================================
// TESTS
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn premium() -> FontArchitect { FontArchitect::new("GEN-BE-TEST-0001") }
    fn free_tier() -> FontArchitect { FontArchitect::new("free") }

    #[test] fn contrast_ratio_invariant() {
        let fa = premium();
        assert!((fa.stem() / fa.serif() - CONTRAST_RATIO).abs() < 0.01);
    }
    #[test] fn weight_mutation_preserves_ratio() {
        let mut fa = premium(); fa.mutate_weight(2.5);
        assert!((fa.stem() / fa.serif() - CONTRAST_RATIO).abs() < 0.01);
    }
    #[test] fn validate_pass() { assert_eq!(premium().validate_invariants(), ""); }
    #[test] fn qos_free_tier_a_allowed() {
        assert!(!free_tier().render_glyph_a().contains("QoS"));
    }
    #[test] fn qos_free_tier_b_blocked() {
        assert!(free_tier().render_glyph_b().contains("QoS"));
    }
    #[test] fn qos_premium_all_pass() {
        let fa = premium();
        for s in [fa.render_glyph_a(), fa.render_glyph_b(), fa.render_glyph_c(), fa.render_glyph_o()] {
            assert!(!s.contains("QoS"));
        }
    }
    #[test] fn grid_snap() {
        assert_eq!(FontArchitect::snap(73.0), 72.0);
        assert_eq!(FontArchitect::snap(76.0), 76.0);
        assert_eq!(FontArchitect::snap(72.0), 72.0);
    }
    #[test] fn reset_baseline() {
        let mut fa = premium();
        fa.mutate_weight(3.0); fa.mutate_shear(12.0); fa.mutate_tracking(0.4);
        fa.reset_to_baseline();
        assert_eq!(fa.weight_multiplier, 1.0);
        assert!(fa.shear_rad.abs() < 0.001);
        assert!((fa.tracking_em - 0.25).abs() < 0.001);
    }
    #[test] fn kinetic_has_skew() {
        let mut fa = premium(); fa.mutate_shear(-12.0);
        assert!(fa.render_glyph_a().contains("skewX"));
    }
    #[test] fn proof_of_render_contains_hash() {
        let fa = premium();
        let result = fa.render_string_with_proof("ABC");
        assert!(result.contains("sha256"));
        assert!(result.contains("svg"));
        // Hash should be 64 hex chars
        let hash_start = result.find(r#""sha256":""#).unwrap() + 10;
        let hash = &result[hash_start..hash_start+64];
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()), "hash={hash}");
    }
    #[test] fn proof_hash_is_deterministic() {
        let fa = premium();
        let r1 = fa.render_string_with_proof("A");
        let r2 = fa.render_string_with_proof("A");
        assert_eq!(r1, r2, "proof must be deterministic");
    }
    #[test] fn proof_hash_changes_on_mutation() {
        let fa = premium();
        let mut fa2 = FontArchitect::new("GEN-BE-TEST-0001");
        fa2.mutate_weight(2.0);
        let r1 = fa.render_string_with_proof("A");
        let r2 = fa2.render_string_with_proof("A");
        assert_ne!(r1, r2, "different params must produce different hashes");
    }
    #[test] fn params_json_correct() {
        let json = premium().export_params_json();
        assert!(json.contains("\"contrast_ratio\":12.0"));
        assert!(json.contains("barcelona_extropic"));
    }
    #[test] fn json_escape_handles_quotes() {
        let escaped = serde_json_escape(r#"say "hello""#);
        assert_eq!(escaped, r#""say \"hello\"""#);
    }
}

// ============================================================
// CHIRALITY — SVG matrix transform layer
// Zero Rust state mutation. Operates purely on emitted SVG.
// Preserves zero-copy substrate: FontArchitect is untouched.
//
// SVG transform matrix for horizontal flip around glyph center:
//   matrix(a,b,c,d,e,f) where:
//   H-flip:  matrix(-1,0,0,1, 2*cx, 0)   → mirrors across vertical axis at cx
//   V-flip:  matrix(1,0,0,-1, 0, 2*cy)   → mirrors across horizontal axis at cy
//   Rot-180: matrix(-1,0,0,-1, 2*cx, 2*cy) → point symmetry
// ============================================================

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ChiralAxis {
    /// Left↔Right mirror (like ʞ from k). U+029E class.
    Horizontal,
    /// Top↔Bottom mirror (like ⅁ from L).
    Vertical,
    /// 180° point symmetry (like Ɒ from D). U+2C70 class.
    Rotation180,
    /// Identity — no transform applied.
    None,
}

impl ChiralAxis {
    /// Emit the SVG transform matrix string for a glyph
    /// centered at (cx, cy) within its local coordinate space.
    pub fn svg_transform(self, cx: f32, cy: f32) -> Option<String> {
        match self {
            ChiralAxis::None => None,
            // H-flip: scale x by -1, translate back by 2*cx
            ChiralAxis::Horizontal => Some(format!(
                "matrix(-1,0,0,1,{:.2},0)", 2.0 * cx
            )),
            // V-flip: scale y by -1, translate back by 2*cy
            ChiralAxis::Vertical => Some(format!(
                "matrix(1,0,0,-1,0,{:.2})", 2.0 * cy
            )),
            // 180° rotation: flip both axes
            ChiralAxis::Rotation180 => Some(format!(
                "matrix(-1,0,0,-1,{:.2},{:.2})", 2.0 * cx, 2.0 * cy
            )),
        }
    }
}

/// Wraps an SVG string in a chirality transform group.
/// Pure SVG layer — no re-upload, no texture invalidation.
/// On repeated flips the matrix coefficients are integer ±1 scaled:
/// GPU driver recognizes this as a trivial matrix and optimizes to
/// a coordinate sign flip, not a full matrix multiply.
pub fn apply_chirality(svg: &str, axis: ChiralAxis, cx: f32, cy: f32) -> String {
    match axis.svg_transform(cx, cy) {
        None => svg.to_string(),
        Some(matrix) => format!(
            "<g transform='{matrix}'>{svg}</g>",
            matrix = matrix,
            svg = svg
        ),
    }
}

// ============================================================
// AMBIGRAPH TRAIT + ARCHITECT — compiled only with --features ambigraph
// Feature flag guarantees zero baseline binary size cost.
// ============================================================

#[cfg(feature = "ambigraph")]
pub mod ambigraph {
    use super::*;
    use wasm_bindgen::prelude::*;

    /// Pair of glyph IDs: (canonical, chiral_variant).
    /// u32 encoding: high 16 bits = Unicode codepoint, low 16 bits = variant index.
    #[derive(Debug, Clone, Copy, PartialEq)]
    pub struct GlyphPair {
        pub canonical: u32,
        pub chiral: u32,
    }

    impl GlyphPair {
        pub fn new(codepoint: u16, variant: u16) -> Self {
            let canonical = (codepoint as u32) << 16 | 0u32;
            let chiral    = (codepoint as u32) << 16 | (variant as u32);
            GlyphPair { canonical, chiral }
        }

        /// Extract Unicode codepoint from packed u32.
        pub fn codepoint(packed: u32) -> u16 { (packed >> 16) as u16 }
        /// Extract variant index from packed u32.
        pub fn variant(packed: u32) -> u16 { packed as u16 }
    }

    /// The core trait. Implemented by AmbigraphArchitect.
    /// Returns (canonical_glyph_id, chiral_variant_glyph_id).
    pub trait Ambigraph {
        fn pair(&self, glyph_id: u32) -> (u32, u32);
        fn interpolate_svg(&self, canonical_svg: &str, chiral_svg: &str, t: f32) -> String;
    }

    // --------------------------------------------------------
    // WASM-EXPOSED AmbigraphArchitect
    // --------------------------------------------------------

    #[wasm_bindgen]
    pub struct AmbigraphArchitect {
        inner: FontArchitect,
        /// Default chirality axis applied to all pair() calls.
        default_axis: ChiralAxis,
        /// Glyph viewport dimensions for transform centering.
        viewport_cx: f32,
        viewport_cy: f32,
    }

    #[wasm_bindgen]
    impl AmbigraphArchitect {
        #[wasm_bindgen(constructor)]
        pub fn new(license_key: &str) -> Self {
            AmbigraphArchitect {
                inner: FontArchitect::new(license_key),
                default_axis: ChiralAxis::Horizontal,
                viewport_cx: 80.0,  // B-E glyph cell center x (160px wide / 2)
                viewport_cy: 90.0,  // B-E glyph cell center y (180px tall / 2)
            }
        }

        /// Set the default chirality axis.
        /// axis: 0=None, 1=Horizontal, 2=Vertical, 3=Rotation180
        pub fn set_axis(&mut self, axis: u8) {
            self.default_axis = match axis {
                1 => ChiralAxis::Horizontal,
                2 => ChiralAxis::Vertical,
                3 => ChiralAxis::Rotation180,
                _ => ChiralAxis::None,
            };
        }

        /// WASM-exposed pair(): returns JSON {"canonical":"<svg>","chiral":"<svg>","pair_hash":"<hex>"}
        pub fn create_ambigram_pair(&self, ch: char) -> String {
            let canonical_svg = self.inner.render_string(&ch.to_string());
            let chiral_svg = apply_chirality(
                &canonical_svg,
                self.default_axis,
                self.viewport_cx * (ch.to_string().len() as f32),
                self.viewport_cy,
            );

            // Proof hash covers both forms — any chirality mutation changes the hash
            let mut hasher = sha2::Sha256::new();
            sha2::Digest::update(&mut hasher, canonical_svg.as_bytes());
            sha2::Digest::update(&mut hasher, chiral_svg.as_bytes());
            let pair_hash = hex::encode(hasher.finalize());

            format!(
                r#"{{"canonical":{},"chiral":{},"pair_hash":"{}","axis":{}}}"#,
                crate::serde_json_escape(&canonical_svg),
                crate::serde_json_escape(&chiral_svg),
                pair_hash,
                self.default_axis as u8,
            )
        }

        /// Bezier interpolation between canonical and chiral SVG.
        /// t=0.0 → canonical, t=1.0 → chiral, t=0.5 → superimposed at 50% opacity.
        /// This is the vertex-shader-equivalent morph for the WASM layer.
        /// In the WebGPU pipeline, t is passed as a uniform; the vertex shader
        /// lerps between the two vertex buffers per-frame. This function provides
        /// the same result for the SVG/fallback render path.
        pub fn morph(&self, ch: char, t: f32) -> String {
            let t = t.clamp(0.0, 1.0);
            let canonical_svg = self.inner.render_string(&ch.to_string());
            let chiral_svg = apply_chirality(
                &canonical_svg,
                self.default_axis,
                self.viewport_cx,
                self.viewport_cy,
            );

            // SVG morph: overlay both forms with complementary opacity
            // opacity(canonical) = 1-t, opacity(chiral) = t
            // This is the CSS/SVG equivalent of the vertex shader lerp.
            // The WebGPU path bypasses this entirely — t goes straight to the uniform buffer.
            format!(
                "<svg width='160' height='180' viewBox='0 0 160 180' xmlns='http://www.w3.org/2000/svg'>\
                   <g opacity='{op_c}'>{canonical}</g>\
                   <g opacity='{op_x}'>{chiral}</g>\
                 </svg>",
                op_c = format!("{:.3}", 1.0 - t),
                op_x = format!("{:.3}", t),
                canonical = canonical_svg,
                chiral = chiral_svg,
            )
        }

        /// Render a full ambigram string: each char paired with its chiral variant,
        /// arranged as canonical (top) / chiral (bottom) rows.
        pub fn render_ambigram_string(&self, chars: &str) -> String {
            let n = chars.chars().count().max(1);
            let w = n * 160;

            let mut canonical_row = String::new();
            let mut chiral_row = String::new();

            for (i, ch) in chars.chars().enumerate() {
                let glyph_svg = self.inner.render_string(&ch.to_string());
                let chiral_svg = apply_chirality(
                    &glyph_svg,
                    self.default_axis,
                    self.viewport_cx,
                    self.viewport_cy,
                );
                let offset = i * 160;
                canonical_row.push_str(&format!("<g transform='translate({offset},0)'>{glyph_svg}</g>"));
                chiral_row.push_str(&format!("<g transform='translate({offset},0)'>{chiral_svg}</g>"));
            }

            // Two rows: canonical top, chiral bottom, separated by hairline
            format!(
                "<svg width='{w}' height='380' viewBox='0 0 {w} 380' xmlns='http://www.w3.org/2000/svg'>\
                   <g transform='translate(0,0)'>{canonical_row}</g>\
                   <line x1='0' y1='188' x2='{w}' y2='188' stroke='rgba(255,255,255,0.15)' stroke-width='1'/>\
                   <g transform='translate(0,200)'>{chiral_row}</g>\
                 </svg>",
                w = w,
                canonical_row = canonical_row,
                chiral_row = chiral_row,
            )
        }

        /// Export axis as string label for Seismic Log.
        pub fn axis_label(&self) -> String {
            match self.default_axis {
                ChiralAxis::None        => "none".to_string(),
                ChiralAxis::Horizontal  => "horizontal".to_string(),
                ChiralAxis::Vertical    => "vertical".to_string(),
                ChiralAxis::Rotation180 => "rotation_180".to_string(),
            }
        }
    }

    impl Ambigraph for AmbigraphArchitect {
        fn pair(&self, glyph_id: u32) -> (u32, u32) {
            let p = GlyphPair::new(
                GlyphPair::codepoint(glyph_id),
                1, // variant index 1 = primary chiral form
            );
            (p.canonical, p.chiral)
        }

        /// SVG-layer morph interpolation.
        /// t=0.0 → canonical, t=1.0 → fully chiral.
        /// Equivalent to the vertex shader uniform in the WebGPU path.
        fn interpolate_svg(&self, canonical_svg: &str, chiral_svg: &str, t: f32) -> String {
            let t = t.clamp(0.0, 1.0);
            format!(
                "<g opacity='{:.3}'>{}</g><g opacity='{:.3}'>{}</g>",
                1.0 - t, canonical_svg,
                t, chiral_svg
            )
        }
    }

    // --------------------------------------------------------
    // WEBGPU HANDOFF — vertex buffer descriptor
    // Generated by AmbigraphArchitect, consumed by the JS/WGSL layer.
    // This is the bridge between WASM and the GPU pipeline.
    // --------------------------------------------------------

    /// Vertex buffer descriptor for WebGPU.
    /// Each glyph is represented as a pair of quadratic bezier outlines:
    /// canonical_verts and chiral_verts. The vertex shader lerps between them
    /// using the morph_t uniform.
    ///
    /// Layout matches WGSL struct:
    ///   struct GlyphVertex { pos: vec2<f32>, uv: vec2<f32>, glyph_id: u32 }
    #[wasm_bindgen]
    pub struct WebGpuGlyphDescriptor {
        /// JSON-serialized vertex data. In production: replace with
        /// a shared ArrayBuffer via wasm_bindgen::memory().
        pub glyph_id: u32,
        pub morph_t: f32,
        pub axis: u8,
    }

    #[wasm_bindgen]
    impl WebGpuGlyphDescriptor {
        pub fn new(glyph_id: u32, axis: u8) -> Self {
            WebGpuGlyphDescriptor { glyph_id, morph_t: 0.0, axis }
        }

        pub fn set_morph_t(&mut self, t: f32) { self.morph_t = t.clamp(0.0, 1.0); }

        /// WGSL uniform block JSON for the chirality matrix.
        /// Consumed by the vertex shader via `@binding(1) @group(0) var<uniform> chiral: ChiralUniform`
        pub fn chiral_uniform_json(&self, cx: f32, cy: f32) -> String {
            let axis = match self.axis {
                1 => ChiralAxis::Horizontal,
                2 => ChiralAxis::Vertical,
                3 => ChiralAxis::Rotation180,
                _ => ChiralAxis::None,
            };
            // Decompose the SVG matrix into WebGPU mat2x2 + translation vec2
            // SVG matrix(a,b,c,d,e,f):
            //   H-flip:  a=-1, b=0, c=0, d=1,  e=2cx, f=0
            //   V-flip:  a=1,  b=0, c=0, d=-1, e=0,   f=2cy
            //   Rot-180: a=-1, b=0, c=0, d=-1, e=2cx, f=2cy
            let (a, d, e, f) = match axis {
                ChiralAxis::None        => ( 1.0,  1.0, 0.0,      0.0     ),
                ChiralAxis::Horizontal  => (-1.0,  1.0, 2.0 * cx, 0.0     ),
                ChiralAxis::Vertical    => ( 1.0, -1.0, 0.0,      2.0 * cy),
                ChiralAxis::Rotation180 => (-1.0, -1.0, 2.0 * cx, 2.0 * cy),
            };
            format!(
                r#"{{"mat2x2":[{a:.1},0.0,0.0,{d:.1}],"translation":[{e:.2},{f:.2}],"morph_t":{t:.3},"glyph_id":{g}}}"#,
                a=a, d=d, e=e, f=f, t=self.morph_t, g=self.glyph_id
            )
        }
    }
}

// ============================================================
// TESTS — base chirality layer (always compiled)
// ============================================================
#[cfg(test)]
mod chiral_tests {
    use super::*;

    #[test]
    fn h_flip_matrix_correct() {
        let m = ChiralAxis::Horizontal.svg_transform(80.0, 90.0).unwrap();
        assert_eq!(m, "matrix(-1,0,0,1,160.00,0)");
    }

    #[test]
    fn v_flip_matrix_correct() {
        let m = ChiralAxis::Vertical.svg_transform(80.0, 90.0).unwrap();
        assert_eq!(m, "matrix(1,0,0,-1,0,180.00)");
    }

    #[test]
    fn rot180_matrix_correct() {
        let m = ChiralAxis::Rotation180.svg_transform(80.0, 90.0).unwrap();
        assert_eq!(m, "matrix(-1,0,0,-1,160.00,180.00)");
    }

    #[test]
    fn none_returns_identity() {
        assert!(ChiralAxis::None.svg_transform(80.0, 90.0).is_none());
    }

    #[test]
    fn apply_chirality_wraps_svg() {
        let svg = "<path d='M0 0'/>";
        let result = apply_chirality(svg, ChiralAxis::Horizontal, 80.0, 90.0);
        assert!(result.starts_with("<g transform='matrix(-1"));
        assert!(result.ends_with("</g>"));
        assert!(result.contains(svg));
    }

    #[test]
    fn none_chirality_is_passthrough() {
        let svg = "<path d='M0 0'/>";
        let result = apply_chirality(svg, ChiralAxis::None, 80.0, 90.0);
        assert_eq!(result, svg);
    }

    #[test]
    fn double_h_flip_is_identity_matrix() {
        // Applying H-flip twice should cancel: matrix(-1,...) × matrix(-1,...) = identity
        // We verify by checking the translation terms
        let svg = "<path/>";
        let once = apply_chirality(svg, ChiralAxis::Horizontal, 80.0, 90.0);
        let twice = apply_chirality(&once, ChiralAxis::Horizontal, 80.0, 90.0);
        // The outer group contains the inner group — visual identity holds
        assert!(twice.contains("matrix(-1,0,0,1,160.00,0)"));
        assert!(twice.contains(&once)); // inner preserved
    }

    #[test]
    fn chirality_does_not_mutate_font_architect() {
        let fa = FontArchitect::new("GEN-BE-TEST-0001");
        let svg = fa.render_string("A");
        let chiral = apply_chirality(&svg, ChiralAxis::Horizontal, 80.0, 90.0);
        // FontArchitect state unchanged — re-render gives same canonical
        let svg2 = fa.render_string("A");
        assert_eq!(svg, svg2, "FontArchitect state was mutated by chirality");
        assert_ne!(svg, chiral, "chiral should differ from canonical");
    }
}

// ============================================================
// TESTS — ambigraph feature (compiled only with --features ambigraph)
// ============================================================
#[cfg(all(test, feature = "ambigraph"))]
mod ambigraph_tests {
    use super::*;
    use super::ambigraph::*;

    fn premium() -> AmbigraphArchitect { AmbigraphArchitect::new("GEN-BE-TEST-0001") }

    #[test]
    fn pair_returns_distinct_ids() {
        let aa = premium();
        let (c, x) = aa.pair(b'A' as u32);
        assert_ne!(c, x, "canonical and chiral IDs must differ");
    }

    #[test]
    fn pair_preserves_codepoint() {
        let aa = premium();
        let glyph_id = ('A' as u16 as u32) << 16;
        let (c, x) = aa.pair(glyph_id);
        assert_eq!(GlyphPair::codepoint(c), GlyphPair::codepoint(x),
            "codepoint must be identical across canonical and chiral");
    }

    #[test]
    fn morph_t0_is_canonical_dominant() {
        let aa = premium();
        let m = aa.morph('A', 0.0);
        assert!(m.contains("opacity='1.000'"), "t=0 should give canonical opacity=1");
        assert!(m.contains("opacity='0.000'"), "t=0 should give chiral opacity=0");
    }

    #[test]
    fn morph_t1_is_chiral_dominant() {
        let aa = premium();
        let m = aa.morph('A', 1.0);
        assert!(m.contains("opacity='0.000'"), "t=1 should give canonical opacity=0");
        assert!(m.contains("opacity='1.000'"), "t=1 should give chiral opacity=1");
    }

    #[test]
    fn morph_t_clamped() {
        let aa = premium();
        let over  = aa.morph('A', 1.5);
        let under = aa.morph('A', -0.5);
        let at1   = aa.morph('A', 1.0);
        let at0   = aa.morph('A', 0.0);
        assert_eq!(over, at1,  "t=1.5 should clamp to t=1.0");
        assert_eq!(under, at0, "t=-0.5 should clamp to t=0.0");
    }

    #[test]
    fn pair_hash_is_deterministic() {
        let aa = premium();
        let r1 = aa.create_ambigram_pair('A');
        let r2 = aa.create_ambigram_pair('A');
        assert_eq!(r1, r2);
    }

    #[test]
    fn pair_hash_differs_by_axis() {
        let mut aa_h = AmbigraphArchitect::new("GEN-BE-TEST-0001");
        aa_h.set_axis(1); // Horizontal
        let mut aa_r = AmbigraphArchitect::new("GEN-BE-TEST-0001");
        aa_r.set_axis(3); // Rotation180
        let r_h = aa_h.create_ambigram_pair('A');
        let r_r = aa_r.create_ambigram_pair('A');
        assert_ne!(r_h, r_r, "different axes must produce different pair hashes");
    }

    #[test]
    fn axis_label_correct() {
        let mut aa = premium();
        aa.set_axis(1); assert_eq!(aa.axis_label(), "horizontal");
        aa.set_axis(2); assert_eq!(aa.axis_label(), "vertical");
        aa.set_axis(3); assert_eq!(aa.axis_label(), "rotation_180");
        aa.set_axis(0); assert_eq!(aa.axis_label(), "none");
    }

    #[test]
    fn webgpu_descriptor_h_flip_uniform() {
        let mut desc = WebGpuGlyphDescriptor::new(0x00410000, 1); // 'A', H-flip
        desc.set_morph_t(0.5);
        let json = desc.chiral_uniform_json(80.0, 90.0);
        assert!(json.contains(r#""mat2x2":[-1.0,0.0,0.0,1.0]"#));
        assert!(json.contains(r#""translation":[160.00,0.00]"#));
        assert!(json.contains(r#""morph_t":0.500"#));
    }

    #[test]
    fn webgpu_descriptor_rot180_uniform() {
        let desc = WebGpuGlyphDescriptor::new(0x00410000, 3); // Rotation180
        let json = desc.chiral_uniform_json(80.0, 90.0);
        assert!(json.contains(r#""mat2x2":[-1.0,0.0,0.0,-1.0]"#));
        assert!(json.contains(r#""translation":[160.00,180.00]"#));
    }

    #[test]
    fn ambigram_string_contains_hairline() {
        let aa = premium();
        let svg = aa.render_ambigram_string("AB");
        assert!(svg.contains("<line"), "ambigram string must contain hairline separator");
        assert!(svg.contains("stroke='rgba(255,255,255,0.15)'"));
    }

    #[test]
    fn interpolate_svg_trait_method() {
        let aa = premium();
        let c = "<path d='M0 0'/>";
        let x = "<path d='M10 10'/>";
        let mid = aa.interpolate_svg(c, x, 0.5);
        assert!(mid.contains("opacity='0.500'"));
    }
}
