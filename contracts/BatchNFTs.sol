// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC721A.sol";

contract BatchNFTs is ERC721A {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant PRICE_PER_TOKEN = 0.1 ether;
    uint256 public immutable START_TIME;
    bool public mintPaused; 
    string private _baseTokenURI;

    constructor() ERC721A("ERC721A Token", "721AT") {
        START_TIME = block.timestamp;
        mintPaused = false;
    }

    function mint(address to, uint256 quantity) external payable {
        // require(!mintPaused, "Mint is paused");
        // require(block.timestamp >= START_TIME, "Sale not started");
        // require(_totalMinted() + quantity <= MAX_SUPPLY, "Max Supply Hit");
        // require(msg.value >= quantity * PRICE_PER_TOKEN, "Insufficient Funds");
        _mint(to, quantity);
    }

    function mintBatchTo(address to, uint256 quantity) external payable {
        // require(!mintPaused, "Mint is paused");
        // require(block.timestamp >= START_TIME, "Sale not started");
        // require(_totalMinted() + quantity <= MAX_SUPPLY, "Max Supply Hit");
        // require(msg.value >= quantity * PRICE_PER_TOKEN, "Insufficient Funds");
        _mint(to, quantity);
    }

    function tokenExists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId();
    }

    // function withdraw() external onlyOwner {
    //     (bool success, ) = msg.sender.call{value: address(this).balance}("");
    //     require(success, "Transfer Failed");
    // }

    // function setBaseURI(string calldata baseURI) external onlyOwner {
    //     _baseTokenURI = baseURI;
    // }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // function pauseMint(bool _paused) external onlyOwner {
    //     require(!mintPaused, "Contract paused.");
    //     mintPaused = _paused;
    // }
}