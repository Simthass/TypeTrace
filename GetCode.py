import os


def collect_text_files(root_dir, output_file="final_output.txt"):
    # Folders to exclude completely
    excluded_dirs = {"node_modules", "__pycache__", ".git", "venv"}
    # File extensions to exclude
    excluded_extensions = {
        ".json",
        ".joblib",
        ".csv",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".svg",
        ".env",
    }

    with open(output_file, "w", encoding="utf-8") as outfile:
        for foldername, subfolders, filenames in os.walk(root_dir):
            # Remove excluded directories from traversal
            subfolders[:] = [d for d in subfolders if d not in excluded_dirs]

            # Skip processing if current folder itself is excluded
            if any(excluded in foldername.split(os.sep) for excluded in excluded_dirs):
                continue

            for filename in filenames:
                # Skip excluded file types
                if any(filename.lower().endswith(ext) for ext in excluded_extensions):
                    continue

                file_path = os.path.join(foldername, filename)
                try:
                    with open(file_path, "r", encoding="utf-8") as infile:
                        outfile.write(f"--- {file_path} ---\n")
                        outfile.write(infile.read())
                        outfile.write("\n\n")
                except Exception as e:
                    # Skip unreadable files
                    outfile.write(f"--- {file_path} ---\n")
                    outfile.write(f"[Skipped: {e}]\n\n")


if __name__ == "__main__":
    current_dir = os.getcwd()
    collect_text_files(current_dir)
    print("All text content has been collected into final_output.txt")
