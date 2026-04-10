
import os

file_path = r"c:\Users\ASUS\.gemini\antigravity\playground\golden-cluster\frontend\src\app\features\client-management\fiches\monture-form\monture-form.component.html"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Split the content
marker = "<!-- ONGLET 3: FACTURATION -->"
if marker not in content:
    print("Marker not found")
    exit(1)

parts = content.split(marker)
base_content = parts[0]
new_tab_content = marker + parts[1]

# Check end of base_content
# It should end with </form> </div> (ignoring whitespace)
# We want to insert new_tab_content BEFORE </form> or inside the form?
# Let's put it BEFORE </form>

form_end_tag = "</form>"
if form_end_tag not in base_content:
    print("Form end tag not found")
    exit(1)

# Split base content at form end
form_parts = base_content.rsplit(form_end_tag, 1)
pre_form_end = form_parts[0]
post_form_end = form_parts[1] 

# Reassemble:
# [Pre Form End]
# [New Tab Content]
# [Form End Tag]
# [Post Form End (includes </div>)]
new_content = pre_form_end + "\n" + new_tab_content + "\n" + form_end_tag + post_form_end

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("File updated successfully")
