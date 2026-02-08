'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface InviteResidentInput {
  email: string;
  first_name: string;
  paternal_surname: string;
  unit_id?: string;
  occupancy_type?: 'owner' | 'tenant' | 'authorized';
}

interface InviteResult {
  success: boolean;
  residentId?: string;
  error?: string;
}

/**
 * Server Action to invite a resident to the community.
 *
 * 1. Gets admin's community_id from their JWT
 * 2. Creates resident record with onboarding_status = 'invited'
 * 3. Creates occupancy if unit_id provided
 * 4. Sends invite email via Supabase Auth Admin API
 *
 * Note: residents.user_id remains NULL until the invited user
 * signs up and the handle_new_user trigger links them via email.
 */
export async function inviteResident(input: InviteResidentInput): Promise<InviteResult> {
  try {
    // Get admin's community from their session
    const serverClient = await createClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    const communityId = user.app_metadata?.community_id;
    if (!communityId) {
      return { success: false, error: 'No se encontro community_id en sesion' };
    }

    const admin = createAdminClient();

    // 1. Create resident record
    const residentId = crypto.randomUUID();
    const { error: residentError } = await admin
      .from('residents')
      .insert({
        id: residentId,
        community_id: communityId,
        first_name: input.first_name,
        paternal_surname: input.paternal_surname,
        email: input.email,
        onboarding_status: 'invited',
        invited_at: new Date().toISOString(),
      });

    if (residentError) {
      return { success: false, error: `Error al crear residente: ${residentError.message}` };
    }

    // 2. Create occupancy if unit was selected
    if (input.unit_id && input.occupancy_type) {
      const { error: occupancyError } = await admin
        .from('occupancies')
        .insert({
          community_id: communityId,
          unit_id: input.unit_id,
          resident_id: residentId,
          occupancy_type: input.occupancy_type,
          start_date: new Date().toISOString().split('T')[0],
        });

      if (occupancyError) {
        // Resident was created but occupancy failed -- log but don't block
        console.error('Occupancy creation failed:', occupancyError.message);
      }
    }

    // 3. Send invite email via Supabase Auth Admin API
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      input.email,
      {
        data: {
          community_id: communityId,
          resident_id: residentId,
        },
      }
    );

    if (inviteError) {
      return {
        success: false,
        error: `Residente creado pero fallo el envio de invitacion: ${inviteError.message}`,
      };
    }

    return { success: true, residentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, error: message };
  }
}
