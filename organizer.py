import os
import shutil

# Mapping: original file → folder name
pages = {
    "compensator.html": "compensator",
    "convCorr.html": "convolution",
    "nyquist.html": "nyquist",
    "rootLocus.html": "root-locus",
    "samplingAliasing.html": "sampling-aliasing",
    "szmap.html": "sz-mapping",
    "stateSpace.html": "State Space"
}

base_dir = os.getcwd()
pages_dir = os.path.join(base_dir, "pages")

# Create pages directory if not exists
os.makedirs(pages_dir, exist_ok=True)

for file_name, folder_name in pages.items():
    src_path = os.path.join(base_dir, file_name)

    if not os.path.exists(src_path):
        print(f"Skipping (not found): {file_name}")
        continue

    # Create subfolder
    dest_folder = os.path.join(pages_dir, folder_name)
    os.makedirs(dest_folder, exist_ok=True)

    # Destination file path
    dest_path = os.path.join(dest_folder, "index.html")

    # Move and rename
    shutil.move(src_path, dest_path)

    print(f"Moved {file_name} → pages/{folder_name}/index.html")

print("\n✅ Organization complete.")