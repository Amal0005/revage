document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('passwordChangeForm');
    const newPass1 = document.getElementById('newPass1');
    const newPass2 = document.getElementById('newPass2');
    const newPass1Error = document.getElementById('newPass1Error');
    const newPass2Error = document.getElementById('newPass2Error');
    const message = document.getElementById('message');

    // Toggle password visibility
    document.querySelectorAll('.eye-icon').forEach(button => {
        button.addEventListener('click', function() {
            const input = document.getElementById(this.dataset.for);
            if (input.type === 'password') {
                input.type = 'text';
                this.textContent = '🔒';
            } else {
                input.type = 'password';
                this.textContent = '👁️';
            }
        });
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        newPass1Error.textContent = '';
        newPass2Error.textContent = '';
        message.classList.add('hidden');

        // Validate password length
        if (newPass1.value.length < 8) {
            newPass1Error.textContent = 'Password must be at least 8 characters long';
            return;
        }

        // Validate password match
        if (newPass1.value !== newPass2.value) {
            newPass2Error.textContent = 'Passwords do not match';
            return;
        }

        try {
            const response = await fetch('/reset-password-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    newPass1: newPass1.value,
                    newPass2: newPass2.value
                })
            });

            const data = await response.json();

            if (response.ok) {
                message.textContent = data.message;
                message.classList.remove('hidden');
                message.classList.remove('bg-red-100', 'text-red-700');
                message.classList.add('bg-green-100', 'text-green-700');
                
                // Redirect to login page after 2 seconds
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                message.textContent = data.message;
                message.classList.remove('hidden');
                message.classList.remove('bg-green-100', 'text-green-700');
                message.classList.add('bg-red-100', 'text-red-700');
            }
        } catch (error) {
            console.error('Error:', error);
            message.textContent = 'An error occurred. Please try again.';
            message.classList.remove('hidden');
            message.classList.remove('bg-green-100', 'text-green-700');
            message.classList.add('bg-red-100', 'text-red-700');
        }
    });
});
