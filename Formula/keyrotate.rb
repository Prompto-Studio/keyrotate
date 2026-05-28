class Keyrotate < Formula
  desc "One-command API-key rotator — 1Password, GitHub, Supabase, Netlify, Fly.io, .env"
  homepage "https://github.com/Prompto-Studio/keyrotate"
  version "0.2.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/Prompto-Studio/keyrotate/releases/download/v0.2.0/keyrotate-darwin-arm64.tar.gz"
      sha256 "e985626d9470f9548c21ed2722b0b74c6b063e52a3191ae8b319547e433957d2"
    end
    on_intel do
      # macOS Intel binary not yet shipped (free GH macos-13 queue is slow).
      # Build from source until v0.3:
      #   git clone https://github.com/Prompto-Studio/keyrotate.git && cd keyrotate && bun install && bun run build
      odie "macOS Intel binary not yet available. Install from source: see https://github.com/Prompto-Studio/keyrotate#install"
    end
  end

  on_linux do
    url "https://github.com/Prompto-Studio/keyrotate/releases/download/v0.2.0/keyrotate-linux-x64.tar.gz"
    sha256 "5a89b2d96845caf0ad1adac4f21ae25d92b8c01bcd3b1b83b90b16ccbbc5c3e0"
  end

  def install
    bin.install "keyrotate"
    bin.install_symlink bin/"keyrotate" => "kr"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/keyrotate version")
  end
end
