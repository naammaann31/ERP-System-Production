const fs = require('fs');
const file = 'lib/announcements.ts';
let content = fs.readFileSync(file, 'utf8');

const oldArchive = `export const archiveAnnouncement = async (id: string) => {
  const supabase = createClient();
  await supabase.from("announcements").update({ archived: true }).eq("id", id);
};`;

const newArchive = `export const archiveAnnouncement = async (id: string) => {
  const supabase = createClient();
  const { data: ann } = await supabase.from("announcements").select("title").eq("id", id).maybeSingle();
  await supabase.from("announcements").update({ archived: true }).eq("id", id);
  if (ann?.title) {
    await supabase.from("notifications").delete().eq("type", "announcement").eq("message", \`New Announcement: \${ann.title}\`);
  }
};`;

const oldDelete = `export const deleteAnnouncement = async (id: string) => {
  const supabase = createClient();
  await supabase.from("announcements").delete().eq("id", id);
};`;

const newDelete = `export const deleteAnnouncement = async (id: string) => {
  const supabase = createClient();
  const { data: ann } = await supabase.from("announcements").select("title").eq("id", id).maybeSingle();
  await supabase.from("announcements").delete().eq("id", id);
  if (ann?.title) {
    await supabase.from("notifications").delete().eq("type", "announcement").eq("message", \`New Announcement: \${ann.title}\`);
  }
};`;

content = content.replace(oldArchive, newArchive);
content = content.replace(oldDelete, newDelete);

fs.writeFileSync(file, content);
console.log("Updated deleteAnnouncement and archiveAnnouncement");
