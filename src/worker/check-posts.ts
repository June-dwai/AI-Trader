
import './init';
import { supabaseAdmin } from '../lib/supabase';

async function checkPosts() {
    console.log("--- CHECKING POSTS IN DB ---");
    const { data: posts, error } = await supabaseAdmin.from('posts').select('*');

    if (error) {
        console.error("❌ Error fetching posts:", error);
    } else {
        console.log(`✅ Found ${posts?.length} posts.`);
        posts?.forEach(p => console.log(`- [${p.id}] ${p.title} (${p.created_at})`));
    }
}

checkPosts();
