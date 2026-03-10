const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env.local manually to ensure we have the vars
const envFile = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
    console.error("No se pudo encontrar la URL o la Service Role Key en .env.local");
    process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseServiceKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
    const email = process.argv[2] || 'admin@nexo.com';
    const password = process.argv[3] || 'Admin123!';

    console.log(`Creando usuario administrador: ${email}...`);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
            first_name: 'Admin',
            last_name: 'Principal',
            role: 'admin'
        }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('El usuario ya existe. Actualizando su rol a admin...');
            // Update existing user role
            const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', email).single();
            if (existingUser) {
                await supabase.from('profiles').update({ role: 'admin' }).eq('id', existingUser.id);
                console.log('✅ Rol actualizado correctamente a admin.');
            }
        } else {
            console.error('Error creando usuario:', authError.message);
        }
        return;
    }

    const userId = authData.user.id;

    // 2. Ensuring the profile has the 'admin' role correctly.
    // The handle_new_user trigger should have run, let's update just in case.
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId);

    if (profileError) {
        console.error('Error actualizando el perfil a admin:', profileError.message);
    } else {
        console.log(`✅ ¡Administrador creado exitosamente!`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    }
}

createAdmin();
