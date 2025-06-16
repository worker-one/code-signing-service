import subprocess
from azure.identity import ClientSecretCredential

def get_access_token(tenant_id, client_id, client_secret):
    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret
    )
    token = credential.get_token("https://codesigning.azure.net/.default")
    return token.token

def run_command(command):
    try:
        # Capture both standard output and error
        result = subprocess.run(command, check=True, shell=True, 
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        # Re-raise with the actual error message from jsign
        error_message = e.stderr if e.stderr else str(e)
        raise Exception(f"Command failed: {error_message}")


from typing import Optional, List

def sign_file(
    input_file_path: str, 
    tenant_id: str,
    client_id: str,
    client_secret: str,
    account_uri: str = "neu.codesigning.azure.net",
    account_name: str = "AccountName1", 
    certificate_name: str = "Certificate1"
) -> None:
    """
    Sign a file using jsign with Azure credentials.
    The input file is signed in-place.
    
    Args:
        input_file_path: Path to the file to be signed
        tenant_id: Azure tenant ID
        client_id: Azure client ID
        client_secret: Azure client secret
        account_name: Azure account name, defaults to "AccountName1"
        certificate_name: Certificate name, defaults to "Certificate1"
    
    Returns:
        None
    """
    token = get_access_token(tenant_id, client_id, client_secret)
    command = (
        f"jsign --storetype TRUSTEDSIGNING "
        f"--keystore {account_uri} "
        f"--storepass {token} "
        f"--alias {account_name}/{certificate_name} "
        f"{input_file_path}"
    )
    print(f"Running command: {command}")
    run_command(command)

