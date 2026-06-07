echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

mkdir -p ~/.local/bin
ln -s $(which fdfind) ~/.local/bin/fd